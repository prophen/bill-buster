/* Hand-written stand-in for `npx convex codegen` output.
   Real codegen runs on `npx convex dev` / `npx convex deploy` once the
   project is linked to a Convex account, and will overwrite this directory. */

import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

export type Doc<TableName extends TableNamesInDataModel<DataModel>> =
  DocumentByName<DataModel, TableName>;

export type Id<
  TableName extends TableNamesInDataModel<DataModel> | SystemTableNames,
> = GenericId<TableName>;
