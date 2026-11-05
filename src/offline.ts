import type {DocumentNode, OperationVariables} from '@apollo/client';
import type {MutationFunctionOptions, SubscriptionHookOptions} from '@apollo/client/react';
import type {FieldNode, OperationDefinitionNode} from 'graphql';
import {produce} from 'immer';
import {OperationTypes, prefixesForAdd, prefixesForRemove, prefixesForUpdate} from './const.js';
import {findArrayInObject, getValueByPath, pick, setValueByPath} from './utils.js';

type Item = {[key: string]: any};

export type OfflineConfig = {
  prefixesForRemove?: string[];
  prefixesForUpdate?: string[];
  prefixesForAdd?: string[];
  getIdFieldFromObject?(item: Item): string | undefined | null;
  idField?: string;
};

export const offlineConfig: OfflineConfig = {
  prefixesForRemove,
  prefixesForUpdate,
  prefixesForAdd,
  idField: 'id'
};

export const setConfig = (config: OfflineConfig) => {
  return Object.assign(offlineConfig, config);
};

export const getOpTypeFromOperationName = (opName = ''): OperationTypes => {
  // Note: we do a toLowerCase() and startsWith() to avoid ambiguity with operations like "RemoveAddendum"
  const comparator = (prefix: string) =>
    opName.toLowerCase().startsWith(prefix) || opName.toLowerCase().startsWith(`on${prefix}`);

  let result = OperationTypes.AUTO;
  [
    [offlineConfig.prefixesForAdd, OperationTypes.ADD],
    [offlineConfig.prefixesForRemove, OperationTypes.REMOVE],
    [offlineConfig.prefixesForUpdate, OperationTypes.UPDATE]
  ].forEach((row) => {
    const [prefix, type] = row as [string[], OperationTypes];
    if (prefix.some(comparator)) {
      result = type;
      return;
    }
  });

  return result;
};

export const updateExistingKeys = <T extends Item>(oldItem: T, newItem: T | undefined) => ({
  ...oldItem,
  ...pick(
    newItem,
    Object.keys(oldItem).filter((key) => key !== '__typename')
  )
});

export const getUpdater = <T extends Item>(
  opType: OperationTypes,
  idField: string
): ((currentValue: T[] | T, newItem?: T) => T[] | T | null | undefined) => {
  switch (opType) {
    case OperationTypes.ADD:
      return (currentValue, newItem) => {
        if (Array.isArray(currentValue)) {
          return newItem
            ? [...currentValue.filter((item) => item[idField] !== newItem[idField]), newItem]
            : [...currentValue];
        } else {
          return newItem;
        }
      };
    case OperationTypes.UPDATE:
      return (currentValue, newItem) => {
        if (Array.isArray(currentValue)) {
          return newItem
            ? currentValue.map((item) =>
                item[idField] === newItem[idField] ? updateExistingKeys<T>(item, newItem) : item
              )
            : [...currentValue];
        } else {
          return updateExistingKeys(currentValue, newItem);
        }
      };
    case OperationTypes.REMOVE:
      return (currentValue, newItem) => {
        if (Array.isArray(currentValue)) {
          return newItem
            ? currentValue.filter((item) => item[idField] !== newItem[idField])
            : [...currentValue];
        } else {
          return null;
        }
      };
    default:
      return (currentValue) => currentValue;
  }
};

export const getOperationFieldName = (operation: DocumentNode): string => {
  const field = (operation.definitions[0] as OperationDefinitionNode).selectionSet
    .selections[0] as FieldNode;
  return field.alias ? field.alias.value : field.name.value;
};

export type QueryWithVariables<TVariables = OperationVariables> = {
  query: DocumentNode;
  variables?: TVariables;
};

export type OfflineOptions<TData> = {
  updateQuery?: QueryWithVariables | DocumentNode;
  updatePath?: string[];
  idField?: string;
  operationType?: OperationTypes;
  mapResultToUpdate?(data: NonNullable<TData>): Item;
};

export type MutationOptions<TData, TVariables extends OperationVariables> = MutationFunctionOptions<
  TData,
  TVariables
> &
  OfflineOptions<TData>;

// The subset of ApolloClient and ApolloCache that updateCache needs, so it accepts either in both
// Apollo Client 3 and 4.
type CacheProxy = {
  readQuery(options: {query: DocumentNode; variables?: any}): any;
  writeQuery(options: {query: DocumentNode; variables?: any; data: any}): any;
};

type UpdateCacheOptions<TData = any> = OfflineOptions<TData> & {
  client: CacheProxy;
  data: TData;
};

export const updateCache = <TData = any>({
  client,
  data,
  idField,
  updateQuery,
  updatePath,
  operationType = OperationTypes.AUTO,
  mapResultToUpdate
}: UpdateCacheOptions<TData>) => {
  if (!data) return;
  const opFieldName = Object.keys(data)[0] as string;
  const opType =
    operationType === OperationTypes.AUTO ? getOpTypeFromOperationName(opFieldName) : operationType;
  if (!(data as any)[opFieldName]) return;
  const mutatedItem = mapResultToUpdate ? mapResultToUpdate(data!) : (data as any)[opFieldName];
  const query = (updateQuery as QueryWithVariables).query || (updateQuery as DocumentNode);
  const queryVars = (updateQuery as QueryWithVariables).variables || {};
  const queryField = getOperationFieldName(query);
  let cachedQueryResult;
  try {
    cachedQueryResult = client.readQuery({
      query,
      variables: queryVars
    });
  } catch {
    return;
  }
  if (!cachedQueryResult) return;
  const idFieldName =
    idField || offlineConfig.getIdFieldFromObject?.(mutatedItem) || offlineConfig.idField!;
  const updaterFn = getUpdater(opType, idFieldName);

  const updatedQueryData = produce(cachedQueryResult, (draft: any) => {
    const opResultCachedValue = draft[queryField];
    const path = updatePath || findArrayInObject(opResultCachedValue);
    const update = updaterFn(getValueByPath(opResultCachedValue, path), mutatedItem);
    if (!path || path.length === 0) {
      draft[queryField] = update;
    } else {
      setValueByPath(opResultCachedValue, path, update);
    }
  });

  client.writeQuery({query, variables: queryVars, data: updatedQueryData});
};

export const getMutationOptions = <
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>({
  updateQuery,
  updatePath,
  idField,
  operationType,
  mapResultToUpdate,
  ...options
}: MutationOptions<TData, TVariables>): MutationFunctionOptions<TData, TVariables> => {
  if (!updateQuery || options.update) return options;
  return {
    update: (client, {data}) => {
      // Apollo Client 3.12+ types `data` as Unmasked<TData>, which is not assignable to TData.
      updateCache<any>({
        client,
        data,
        idField,
        mapResultToUpdate,
        operationType,
        updateQuery,
        updatePath
      });
    },
    ...options
  };
};

export type SubscriptionOptions<
  TData,
  TVariables extends OperationVariables
> = SubscriptionHookOptions<TData, TVariables> & OfflineOptions<TData>;

export const getSubscriptionOptions = <
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>({
  updateQuery,
  updatePath,
  idField,
  operationType,
  mapResultToUpdate,
  ...options
}: SubscriptionOptions<TData, TVariables>): SubscriptionHookOptions<TData, TVariables> => {
  // Apollo Client 3 calls only onData when both callbacks are set, so a user's
  // onSubscriptionData (removed in Apollo Client 4) must also disable the cache update.
  if (!updateQuery || options.onData || 'onSubscriptionData' in options) {
    return options as SubscriptionHookOptions<TData, TVariables>;
  }
  return {
    onData: ({client, data: {data}}) => {
      updateCache({
        client,
        data,
        updateQuery,
        updatePath,
        operationType,
        idField,
        mapResultToUpdate
      });
    },
    ...options
  } as SubscriptionHookOptions<TData, TVariables>;
};
