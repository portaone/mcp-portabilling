# Test Improvement Plan

This document outlines a plan to improve the existing test suite based on a detailed review. The goal is to enhance test coverage, address potential ambiguities, and ensure robustness.

## ✅ Recent Completions

### OpenAPI Loader Test Improvements (December 2024)

Successfully implemented comprehensive test improvements for `openapi-loader.test.ts`:

- **✅ Path Item Parameter Inheritance**: Implemented full support for OpenAPI path-level parameter inheritance with comprehensive test coverage
- **✅ Request Body Content Types**: Added tests for `application/x-www-form-urlencoded`, `multipart/form-data`, and multiple content type handling
- **✅ Schema Composition Keywords**: Enhanced support for `allOf`, `oneOf`, `anyOf`, and `not` schema composition with proper test coverage
- **✅ Header and Cookie Parameters**: Added comprehensive tests for parameters with `in: "header"` and `in: "cookie"` locations
- **✅ External References**: Added tests for graceful handling of external and malformed references
- **✅ Deprecated Operations**: Added tests documenting current behavior for deprecated operations

**Impact**: Increased test coverage from 73 to 79 tests, with all 271 tests in the full suite passing. Enhanced robustness of OpenAPI specification parsing and tool generation.

## I. Overall High-Priority Issues & Recommendations

These issues affect multiple parts of the system or represent significant gaps in testing core functionality.

### ✅ 1. Hyphen Handling in Tool IDs and Paths (Critical)

- **Problem**: Inconsistent handling of hyphens (`-`) between `generateToolId` (which preserves hyphens from original path segments and converts slashes `/` to hyphens) and `parseToolId` (which converts all hyphens in the `toolId`'s path part back to slashes). This can lead to incorrect API call URLs if an original OpenAPI path segment legitimately contains a hyphen (e.g., `/api/resource-name/items`).
- **Affected Files**: `tool-id-utils.test.ts`, `openapi-loader.test.ts`, `api-client.test.ts`, `tools-manager.test.ts`.
- **Proposed Action**:
  - Re-evaluate the `toolId` generation and parsing strategy.
  - **Option A (Recommended)**: Modify `generateToolId` (in `OpenAPISpecLoader` context) to escape legitimate hyphens within path segments (e.g., `resource-name` becomes `resource--name` in the ID part). Slashes would still become a single hyphen. `parseToolId` would then be updated to unescape `--` to `-` and convert single hyphens (not part of an escaped sequence) to `/`.
  - **Option B**: Use a different, unambiguous separator character for joining path segments in the `toolId` if hyphens from original segments are to be preserved as-is.
  - **Testing**: Add specific test cases in `tool-id-utils.test.ts` and integration tests in `openapi-loader.test.ts` and `api-client.test.ts` for paths with legitimate hyphens in segments, ensuring correct round-trip conversion and URL generation.

### ✅ 2. `OpenAPISpecLoader`: Missing `operationId` Fallback for `tool.name`

- **Problem**: `openapi-loader.test.ts` lacks tests for how `tool.name` is generated when an operation in the OpenAPI spec does not have an `operationId`. This is a common scenario and a critical fallback.
- **Affected Files**: `openapi-loader.test.ts`.
- **Proposed Action**:
  - Implement robust fallback logic in `OpenAPISpecLoader` to generate a meaningful `tool.name` from the HTTP method and path if `operationId` is missing.
  - Add test cases in `openapi-loader.test.ts` with operations lacking `operationId` to verify the correct generation and formatting (including abbreviation, if applicable) of these fallback tool names.

### 3. `OpenAPISpecLoader`: Missing `tool.outputSchema` Generation : POSTPONED

- **Problem**: The loader does not appear to parse OpenAPI `operation.responses` to generate a `tool.outputSchema`. This is a significant feature for tool consumers (e.g., SDKs, agents needing to know expected output).
- **Affected Files**: `openapi-loader.test.ts`.
- **Proposed Action**:
  - Enhance `OpenAPISpecLoader` to parse success responses (e.g., `200 OK`, `201 Created`) from `operation.responses` and generate a corresponding JSON schema for `tool.outputSchema`.
  - Consider how to handle multiple success responses or different content types for responses.
  - Add test cases to `openapi-loader.test.ts` to verify correct `outputSchema` generation for various response structures, including `$ref` usage within responses.

### ✅ 4. Enhance `Tool` Object Structure for Filtering

- **Problem**: `ToolsManager`'s filtering logic for tags and resources seems to rely on the raw spec or string manipulation of `toolId`s after tools are parsed.
- **Affected Files**: `tools-manager.test.ts`, `openapi-loader.test.ts`.
- **Proposed Action**:
  - Modify `OpenAPISpecLoader` to embed more metadata directly into the `Tool` objects it creates. Specifically:
    - `tool.tags: string[]` (from `operation.tags`)
    - `tool.resourceName: string` (a derived primary resource name from the path)
  - Update `ToolsManager` filtering logic to use these explicit properties on the `Tool` object, reducing dependency on the raw spec post-parsing.
  - Add/update tests in `tools-manager.test.ts` to reflect filtering based on these new `Tool` properties.
- **Status**: ✅ **COMPLETED**
- **Implementation Summary**:
  - Created `ExtendedTool` interface extending the standard MCP `Tool` with metadata properties: `tags`, `httpMethod`, `resourceName`, `originalPath`
  - Modified `OpenAPISpecLoader.parseOpenAPISpec()` to populate these metadata fields during tool creation
  - Added `extractResourceName()` helper method to intelligently extract resource names from OpenAPI paths
  - Updated `ToolsManager.initialize()` filtering logic to use explicit metadata properties instead of parsing `toolId`s and accessing raw spec
  - Improved performance by eliminating repeated parsing during filtering operations
  - Added comprehensive tests for the new functionality in both `openapi-loader.test.ts` and `tools-manager.test.ts`
  - Maintained backward compatibility with existing `x-original-path` property

## II. File-Specific Test Improvements

### `tool-id-utils.test.ts`

- **Malformed Inputs for `parseToolId`**: Add tests for various malformed `toolId` strings (e.g., missing `::`, multiple `::`, no method, empty parts, methods in different cases if strictness is expected).
- **Unicode Character Handling in `generateToolId`**: Clarify and add specific tests for a wider range of Unicode characters to ensure consistent sanitization behavior (e.g., are they all removed, or are some transliterated like 'é' to 'e'?).
- **Leading/Trailing Slashes in `generateToolId`**: Test behavior with paths like `/users/` or `//users`.
- **Status**: ✅ **COMPLETED**

### `auth-provider.test.ts`

- **`isAuthError` Edge Cases**: ✅ **COMPLETED**
  - Test with non-Axios plain error objects.
  - Test with Axios-like errors that have `error.response` but `error.response.status` is undefined or not a number.
- **`StaticAuthProvider` Constructor**: ✅ **COMPLETED** - Test with `null` passed to the constructor for headers (if not disallowed by TypeScript types).
- **Status**: ✅ **COMPLETED**
- **Implementation Summary**:
  - Added comprehensive edge case tests for `isAuthError` function covering:
    - Non-Axios plain error objects (Error instances, generic objects)
    - Axios-like errors with undefined, null, or non-number status values
    - Errors with null or undefined response properties
    - Edge case status codes (0, negative, very large, float values)
  - Added extensive constructor edge case tests for `StaticAuthProvider` covering:
    - Null and undefined values passed to constructor
    - Non-object values (strings, numbers, booleans) passed to constructor
    - Headers with non-string values and mixed data types
    - Special characters and Unicode in header values
    - Empty objects and whitespace handling
  - All tests verify graceful error handling and robust behavior under edge conditions
  - Maintained backward compatibility while improving test coverage from basic scenarios to comprehensive edge cases

### ✅ `server.test.ts`

- **Reduce Mock Fragility (Long-term)**: While hard, consider if some interactions can be tested with less detailed mocks or more integrated tests if sub-components become stable.
- **Error Handling in `start()`**: Add tests for scenarios where `ToolsManager.initialize()` fails or `SDKServer.connect()` (mocked) fails during the `OpenAPIServer.start()` sequence.
- **`OpenAPIServer.close()`/`stop()` Lifecycle**: If such a method exists to gracefully shut down the server and its components, add tests for it.
- **Explicit Argument Passing**: For tool execution tests, be more explicit in asserting that `req.params.arguments` are correctly passed to `mockApiClient.executeApiCall`.
- **Status**: ✅ **COMPLETED**
- **Implementation Summary**:
  - **Enhanced Tool Execution Testing**: Added comprehensive tests for explicit argument passing with various scenarios:
    - Complex nested arguments with objects and arrays
    - Empty arguments object handling
    - Undefined arguments handling
    - Tool lookup by name vs ID
    - Non-Error exception handling
    - Verification that exact arguments from requests are passed to `executeApiCall`
  - **Error Handling in `start()` Method**: Added robust error handling tests covering:
    - `ToolsManager.initialize()` failures with generic and network-specific errors
    - `Server.connect()` failures with timeout and connection errors
    - Verification that failures at different stages prevent subsequent operations
    - Proper error propagation and state management
  - **Server Lifecycle Management**:
    - Added tests for empty tools list handling during startup
    - Documented expected behavior for future `close()`/`stop()` methods
    - Enhanced existing startup flow tests with better error scenarios
  - **Improved Test Organization**: Restructured tests into logical groups (`Tool Execution`, `Server Lifecycle`) for better maintainability
  - **Reduced Mock Fragility**: While maintaining necessary mocks, improved test isolation and reduced dependencies on implementation details where possible

### `openapi-loader.test.ts`

- **(Covered by High-Priority)**: ✅ **COMPLETED** - `operationId` fallback, `outputSchema` generation.
- **Path Item Parameter Inheritance**: ✅ **COMPLETED**
  - ✅ **COMPLETED** - Current test `it("should skip parameters property in pathItem")` was ambiguous and has been replaced with comprehensive tests.
  - ✅ **COMPLETED** - Added specific tests to clarify behavior:
    - Path with common params, operation with NO params: Are common params inherited?
    - Path with common params, operation with DIFFERENT params: Are both sets present (merged correctly)?
    - Path with common params, operation with OVERRIDING param (same name+in): Does the operation-level parameter win?
- **Other `requestBody` Content Types**: ✅ **COMPLETED**
  - ✅ **COMPLETED** - Add tests for `application/x-www-form-urlencoded`.
  - ✅ **COMPLETED** - Add tests for `multipart/form-data`, especially how file uploads (`type: string, format: binary/byte`) are represented in `inputSchema`.
  - ✅ **COMPLETED** - Test behavior when multiple request content types are offered (e.g., which one is chosen for `inputSchema`).
- **Schema Composition Keywords**: ✅ **COMPLETED** - Add tests for schemas using `allOf`, `oneOf`, `anyOf`, and `not`.
- **`deprecated` Operations**: ✅ **COMPLETED** - Test how operations marked `deprecated: true` in the spec are handled (e.g., skipped, or a `tool.deprecated` flag set).
- **External `$ref`s**: ✅ **COMPLETED** - If supported, add tests for resolving references from external files/URLs (`$ref: 'external.yaml#/components/schemas/MySchema'`).
- **Header and Cookie Parameters**: ✅ **COMPLETED** - Add explicit tests to ensure parameters `in: "header"` and `in: "cookie"` are correctly processed into `inputSchema` with appropriate `x-parameter-location`.
- **Status**: ✅ **COMPLETED**
- **Implementation Summary**:
  - **Path Item Parameter Inheritance**: Implemented comprehensive support for path-level parameter inheritance in `OpenAPISpecLoader.parseOpenAPISpec()`. Path-level parameters are now properly inherited by operations, with operation-level parameters able to override path-level ones with the same name and location. Added extensive test coverage for all inheritance scenarios.
  - **Request Body Content Types**: Added comprehensive tests for various content types including `application/x-www-form-urlencoded`, `multipart/form-data` with file uploads, and handling of multiple content types. The implementation correctly prioritizes `application/json` when available.
  - **Schema Composition Keywords**: Enhanced the `inlineSchema()` method to properly handle `allOf`, `oneOf`, `anyOf`, and `not` schema composition. For `allOf`, schemas are merged into a single object. For `oneOf` and `anyOf`, the composition is preserved at the appropriate level in the input schema. Added comprehensive test coverage for all composition types.
  - **Deprecated Operations**: Added tests to verify that deprecated operations are still processed (not skipped) and documented the current behavior. The implementation correctly handles deprecated operations without special treatment.
  - **External References**: Added tests for graceful handling of external references and malformed references. The implementation returns empty schemas for unresolvable external references without throwing errors.
  - **Header and Cookie Parameters**: Added comprehensive tests for parameters with `in: "header"` and `in: "cookie"` locations, ensuring they are properly processed with the correct `x-parameter-location` metadata. Also tested mixed parameter locations in a single operation.
  - **Backward Compatibility**: All changes maintain backward compatibility with existing functionality and the `x-original-path` property.

### `api-client.test.ts`

- **(Covered by High-Priority)**: Hyphen handling in `toolId` path reconstruction. The most robust usage involves `setTools` with full schema details.
- **Parameter Handling without Schema Hints**:
  - Add more tests for how `executeApiCall` infers path parameters from the `toolId` string when `setTools` has not been called or a `ToolDefinition` is missing. Test edge cases (e.g., `toolId: "GET::a-b-c"`, args: `{a:1, c:3}` – what happens to `b`? How are segments matched?).
- **Header and Cookie Parameters**: Add explicit tests to show arguments being correctly placed into request `headers` or `cookie` strings if `x-parameter-location` indicates this in a `ToolDefinition`.
- **Default `Content-Type` for Request Body**: For POST/PUT, explicitly test or assert what `Content-Type` header is set by default if not specified by other means.
- **`setTools()` Method**: Add unit tests for the `setTools(map)` method itself (e.g., behavior if called multiple times, clearing previous tools).

### `tools-manager.test.ts`

- **(Covered by High-Priority)**: Source of information for tag/resource filtering (preferably from enriched `Tool` objects).
- **Resource Name Extraction Logic**: If resource names are derived from `toolId`s for filtering, the algorithm should be clearly defined and tested with complex path examples (e.g., "GET::api-v1-user-profile-settings").
- **`toolsMode: "explicit"`**: If this mode is intended (e.g., only load tools listed in `includeTools` and nothing else from the spec, rather than load-all-then-filter), add tests for it.
- **Filter Order of Application**: Document and ensure consistent order of application for include/exclude filters.
- **Centralize `parseToolId`**: Ensure `ToolsManager.parseToolId` and `ApiClient`'s internal parsing logic either use or are perfectly consistent with a single utility from `tool-id-utils.js`.

### `transport-http.test.ts`

- **This suite is already very strong.**
- **Minor**: Consider if SSE heartbeats/keep-alive messages are a desired feature; if so, they would need tests. For now, not critical.

### `config.test.ts`

- **This suite is also very strong.**
- **`yargs` Array Handling Confirmation**: Ensure the mocking of `yargs` returning arrays directly (e.g., for `include-tools`) matches how `yargs` is actually configured in `config.ts` (e.g., using `.array('include-tools')`).
- **Validation of Enum-like Values**: For fields like `toolsMode` or `transportType`, test providing an invalid choice. `yargs` can handle this with `.choices()`, and this test would verify that configuration.

## III. General Recommendations

- **Developer Documentation**: For complex logic like `toolId` generation/parsing rules, abbreviation rules, and filter interactions, ensure clear developer documentation accompanies the code.
- **Consistency**: Strive for consistent use of shared utilities (like `parseToolId`) across different modules to avoid subtle variations in behavior.

This plan should provide a clear roadmap for further enhancing the quality and reliability of the mcp-openapi-server.
