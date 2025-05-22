import { OpenAPIV3 } from "openapi-types"
import { readFile } from "fs/promises"
import { Tool } from "@modelcontextprotocol/sdk/types.js"
import yaml from "js-yaml"
import crypto from "crypto"
import { REVISED_COMMON_WORDS_TO_REMOVE, WORD_ABBREVIATIONS } from "./abbreviations.js"

/**
 * Class to load and parse OpenAPI specifications
 */
export class OpenAPISpecLoader {
  /**
   * Disable name optimization
   */
  private disableAbbreviation: boolean

  constructor(config?: { disableAbbreviation?: boolean }) {
    this.disableAbbreviation = config?.disableAbbreviation ?? false
  }

  /**
   * Load an OpenAPI specification from a file path or URL
   */
  async loadOpenAPISpec(specPathOrUrl: string): Promise<OpenAPIV3.Document> {
    let specContent: string
    if (specPathOrUrl.startsWith("http://") || specPathOrUrl.startsWith("https://")) {
      const response = await fetch(specPathOrUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec from URL: ${specPathOrUrl}`)
      }
      specContent = await response.text()
    } else {
      specContent = await readFile(specPathOrUrl, "utf-8")
    }

    // Attempt to parse as JSON, then YAML if JSON parsing fails
    try {
      return JSON.parse(specContent) as OpenAPIV3.Document
    } catch (jsonError) {
      try {
        return yaml.load(specContent) as OpenAPIV3.Document
      } catch (yamlError) {
        throw new Error(
          `Failed to parse OpenAPI spec as JSON or YAML: ${
            (jsonError as Error).message
          } | ${(yamlError as Error).message}`,
        )
      }
    }
  }

  /**
   * Inline `$ref` schemas from components and drop recursive cycles
   */
  private inlineSchema(
    schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
    components: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject> | undefined,
    visited: Set<string>,
  ): OpenAPIV3.SchemaObject {
    // Handle reference objects
    if ("$ref" in schema && typeof schema.$ref === "string") {
      const ref = schema.$ref
      const match = ref.match(/^#\/components\/schemas\/(.+)$/)
      if (match && components) {
        const name = match[1]
        if (visited.has(name)) {
          return {} as OpenAPIV3.SchemaObject
        }
        const comp = components[name]
        if (!comp) {
          return {} as OpenAPIV3.SchemaObject
        }
        visited.add(name)
        return this.inlineSchema(comp, components, visited)
      }
    }

    // We know it's a SchemaObject now since ReferenceObject only has $ref
    const schemaObj = schema as OpenAPIV3.SchemaObject

    // Inline object schemas
    if (schemaObj.type === "object" && schemaObj.properties) {
      const newProps: Record<string, OpenAPIV3.SchemaObject> = {}
      for (const [propName, propSchema] of Object.entries(schemaObj.properties)) {
        newProps[propName] = this.inlineSchema(
          propSchema as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
          components,
          new Set(visited),
        )
      }
      return { ...schemaObj, properties: newProps } as OpenAPIV3.SchemaObject
    }
    // Inline array schemas
    if (schemaObj.type === "array" && schemaObj.items) {
      return {
        ...schemaObj,
        items: this.inlineSchema(
          schemaObj.items as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
          components,
          new Set(visited),
        ),
      } as OpenAPIV3.SchemaObject
    }
    return schemaObj
  }

  /**
   * Parse an OpenAPI specification into a map of tools
   */
  parseOpenAPISpec(spec: OpenAPIV3.Document): Map<string, Tool> {
    const tools = new Map<string, Tool>()

    // Convert each OpenAPI path to an MCP tool
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) continue

      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === "parameters" || !operation) continue

        // Skip invalid HTTP methods
        if (
          !["get", "post", "put", "patch", "delete", "options", "head"].includes(
            method.toLowerCase(),
          )
        ) {
          console.log(`Skipping non-HTTP method "${method}" for path ${path}`)
          continue
        }

        const op = operation as OpenAPIV3.OperationObject
        const cleanPath = path.replace(/^\//, "").replace(/\{([^}]+)\}/g, "$1")
        const toolId = `${method.toUpperCase()}-${cleanPath}`.replace(/[^a-zA-Z0-9-]/g, "-")

        let nameSource = op.operationId || op.summary || `${method.toUpperCase()} ${path}`
        const name = this.abbreviateOperationId(nameSource)

        const tool: Tool = {
          name,
          description: op.description || `Make a ${method.toUpperCase()} request to ${path}`,
          inputSchema: {
            type: "object",
            properties: {},
          },
        }

        // Gather all required property names
        const requiredParams: string[] = []

        // Merge parameters into inputSchema
        if (op.parameters) {
          for (const param of op.parameters) {
            let paramObj: OpenAPIV3.ParameterObject

            // Handle parameter references by resolving them
            if (!("name" in param)) {
              // This is a reference, attempt to resolve it
              if ("$ref" in param && typeof param.$ref === "string") {
                const refMatch = param.$ref.match(/^#\/components\/parameters\/(.+)$/)
                if (refMatch && spec.components?.parameters) {
                  const paramName = refMatch[1]
                  const resolvedParam = spec.components.parameters[paramName]

                  // Skip if we can't resolve the reference
                  if (!resolvedParam || !("name" in resolvedParam)) continue

                  paramObj = resolvedParam as OpenAPIV3.ParameterObject
                } else {
                  continue // Skip unresolvable references
                }
              } else {
                continue // Skip if not a proper $ref
              }
            } else {
              paramObj = param as OpenAPIV3.ParameterObject
            }

            if (paramObj.schema) {
              // Get the fully inlined schema with all nested references resolved
              const paramSchema = this.inlineSchema(
                paramObj.schema as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
                spec.components?.schemas,
                new Set<string>(),
              )

              // Create the parameter with just the essential properties first
              const paramDef: any = {
                description: paramObj.description || `${paramObj.name} parameter`,
              }

              // Preserve the type
              if (paramSchema.type) {
                paramDef.type = paramSchema.type
              } else {
                paramDef.type = "string" // Default to string if no type specified
              }

              // Copy relevant properties from the inlined schema
              // This preserves nested structures while avoiding type issues
              for (const [key, value] of Object.entries(paramSchema)) {
                // Skip the type and properties already set
                if (key === "type" || key === "description") continue

                // Copy the property
                paramDef[key] = value
              }

              // Add the schema to the tool's input schema properties
              tool.inputSchema.properties![paramObj.name] = paramDef

              if (paramObj.required === true) {
                requiredParams.push(paramObj.name)
              }
            }
          }
        }

        // Merge requestBody schema into inputSchema
        if (op.requestBody && "content" in op.requestBody) {
          const requestBodyObj = op.requestBody as OpenAPIV3.RequestBodyObject

          // Handle different content types
          let mediaTypeObj: OpenAPIV3.MediaTypeObject | undefined

          if (requestBodyObj.content["application/json"]) {
            mediaTypeObj = requestBodyObj.content["application/json"]
          } else if (Object.keys(requestBodyObj.content).length > 0) {
            // Take the first available content type
            const firstContentType = Object.keys(requestBodyObj.content)[0]
            mediaTypeObj = requestBodyObj.content[firstContentType]
          }

          if (mediaTypeObj?.schema) {
            // Handle schema inlining with proper types
            const inlinedSchema = this.inlineSchema(
              mediaTypeObj.schema as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
              spec.components?.schemas,
              new Set<string>(),
            )

            // Include all properties from inlinedSchema for object, else use body wrapper
            if (inlinedSchema.type === "object" && inlinedSchema.properties) {
              // Handle object properties
              for (const [propName, propSchema] of Object.entries(inlinedSchema.properties)) {
                const paramName = tool.inputSchema.properties![propName]
                  ? `body_${propName}`
                  : propName

                tool.inputSchema.properties![paramName] = propSchema as OpenAPIV3.SchemaObject

                if (inlinedSchema.required && inlinedSchema.required.includes(propName)) {
                  requiredParams.push(paramName)
                }
              }
            } else {
              // Use body wrapper for non-object schemas
              tool.inputSchema.properties!["body"] = inlinedSchema
              requiredParams.push("body")
            }
          }
        }

        // Only add the required array if there are required properties
        if (requiredParams.length > 0) {
          tool.inputSchema.required = requiredParams
        }

        tools.set(toolId, tool)
      }
    }

    return tools
  }

  // Helper function to generate a simple hash
  private generateShortHash(input: string, length: number = 4): string {
    return crypto.createHash("sha256").update(input).digest("hex").substring(0, length)
  }

  // Helper to split by underscore, camelCase, and numbers, then filter out empty strings
  private splitCombined(input: string): string[] {
    // Split by underscore first
    const underscoreParts = input.split("_")
    let combinedParts: string[] = []

    underscoreParts.forEach((part) => {
      // Add space before uppercase letters (camelCase) and before numbers
      const spacedPart = part
        .replace(/([A-Z]+)/g, " $1") // Handles sequences of uppercase like "MYID"
        .replace(/([A-Z][a-z])/g, " $1") // Handles regular camelCase like "MyIdentifier"
        .replace(/([a-z])([0-9])/g, "$1 $2") // Handles case like "word123"
        .replace(/([0-9])([A-Za-z])/g, "$1 $2") // Handles case like "123word"

      const splitParts = spacedPart.split(" ").filter((p) => p.length > 0)
      combinedParts = combinedParts.concat(splitParts)
    })
    return combinedParts.map((p) => p.trim()).filter((p) => p.length > 0)
  }

  private _initialSanitizeAndValidate(
    originalId: string,
    maxLength: number,
  ): { currentName: string; originalWasLong: boolean; errorName?: string } {
    if (!originalId || originalId.trim().length === 0)
      return { currentName: "", originalWasLong: false, errorName: "unnamed-tool" }

    const originalWasLong = originalId.length > maxLength
    let currentName = originalId.replace(/[^a-zA-Z0-9_]/g, "-")
    currentName = currentName.replace(/-+/g, "-").replace(/^-+|-+$/g, "")

    if (currentName.length === 0)
      return {
        currentName: "",
        originalWasLong,
        errorName: "tool-" + this.generateShortHash(originalId, 8),
      }

    return { currentName, originalWasLong }
  }

  private _performSemanticAbbreviation(name: string): string {
    let parts = this.splitCombined(name)
    parts = parts.filter((part) => {
      const cleanPartForCheck = part.toLowerCase().replace(/-+$/, "")
      return !REVISED_COMMON_WORDS_TO_REMOVE.includes(cleanPartForCheck)
    })

    parts = parts.map((part) => {
      const lowerPart = part.toLowerCase()
      if (WORD_ABBREVIATIONS[lowerPart]) {
        const abbr = WORD_ABBREVIATIONS[lowerPart]
        if (
          part.length > 0 &&
          part[0] === part[0].toUpperCase() &&
          part.slice(1) === part.slice(1).toLowerCase()
        ) {
          return abbr[0].toUpperCase() + abbr.substring(1).toLowerCase()
        } else if (part === part.toUpperCase() && part.length > 1 && abbr.length > 1) {
          return abbr.toUpperCase()
        } else if (part.length > 0 && part[0] === part[0].toUpperCase()) {
          return abbr[0].toUpperCase() + abbr.substring(1).toLowerCase()
        }
        return abbr.toLowerCase()
      }
      return part
    })
    return parts.join("-")
  }

  private _applyVowelRemovalIfOverLength(name: string, maxLength: number): string {
    let currentName = name
    if (currentName.length > maxLength) {
      const currentParts = currentName.split("-")
      const newParts = currentParts.map((part) => {
        const isAbbreviation = Object.values(WORD_ABBREVIATIONS).some(
          (abbr) => abbr.toLowerCase() === part.toLowerCase(),
        )
        if (part.length > 5 && !isAbbreviation) {
          const newPart = part[0] + part.substring(1).replace(/[aeiouAEIOU]/g, "")
          if (newPart.length < part.length && newPart.length > 1) return newPart
        }
        return part
      })
      currentName = newParts.join("-")
    }
    return currentName
  }

  private _truncateAndApplyHashIfNeeded(
    name: string,
    originalId: string,
    originalWasLong: boolean,
    maxLength: number,
  ): string {
    let currentName = name
    currentName = currentName.replace(/-+/g, "-").replace(/^-+|-+$/g, "") // Consolidate hyphens before length check for hashing

    const needsHash = originalWasLong || currentName.length > maxLength

    if (needsHash) {
      const hash = this.generateShortHash(originalId, 4)
      const maxLengthForBase = maxLength - hash.length - 1

      if (currentName.length > maxLengthForBase) {
        currentName = currentName.substring(0, maxLengthForBase)
        currentName = currentName.replace(/-+$/, "")
      }
      currentName = currentName + "-" + hash
    }
    return currentName
  }

  private _finalizeNameFormatting(name: string, originalId: string, maxLength: number): string {
    let finalName = name.toLowerCase()
    finalName = finalName
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")

    if (finalName.length > maxLength) {
      finalName = finalName.substring(0, maxLength)
      finalName = finalName.replace(/-+$/, "")
    }
    if (finalName.length === 0) {
      return "tool-" + this.generateShortHash(originalId, 8)
    }
    return finalName
  }

  public abbreviateOperationId(originalId: string, maxLength: number = 64): string {
    maxLength = this.disableAbbreviation ? Number.MAX_SAFE_INTEGER : maxLength
    const {
      currentName: sanitizedName,
      originalWasLong,
      errorName,
    } = this._initialSanitizeAndValidate(originalId, maxLength)
    if (errorName) return errorName

    let processedName
    if (this.disableAbbreviation) {
      processedName = this.splitCombined(sanitizedName).join("-")
    } else {
      processedName = this._performSemanticAbbreviation(sanitizedName)
      processedName = this._applyVowelRemovalIfOverLength(processedName, maxLength)
    }
    processedName = this._truncateAndApplyHashIfNeeded(
      processedName,
      originalId,
      originalWasLong,
      maxLength,
    )
    processedName = this._finalizeNameFormatting(processedName, originalId, maxLength)

    return processedName
  }
}
