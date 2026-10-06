// The id of the app's A2UI catalog: the basic catalog plus ProgressBar
// (components/a2ui-catalog.tsx). A surface names it in `createSurface`, and the chat
// renders only surfaces on a catalog it has. Kept apart from the catalog itself, so the
// server can name it without loading the React renderer.
export const TODO_CAT_CATALOG_ID = "todo-cat://catalog/v1";
