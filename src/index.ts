import type {DocumentNode, OperationVariables} from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
import * as offline from './offline.js';

export * from './const.js';
export * from '@apollo/client';
// Apollo Client 4 moved the React API out of the root entry point. In Apollo Client 3 both entry
// points export the same bindings, so the second re-export adds nothing there.
export * from '@apollo/client/react';

// Both Apollo Client 4 entry points export an internal, type-only `InternalTypes` namespace, which
// makes the two star re-exports ambiguous (TS2308). A local export takes precedence over both.
// Apollo Client 3 has no such namespace, so an explicit re-export would not compile there.
export declare namespace InternalTypes {}

export type OfflineOptions<TData> = offline.OfflineOptions<TData>;
export const setOfflineConfig = offline.setConfig;
export const updateApolloCache = offline.updateCache;

export type MutationHookOptions<
  TData,
  TVariables extends OperationVariables
> = ApolloReact.MutationHookOptions<TData, TVariables> & OfflineOptions<TData>;

export type MutationFunctionOptions<
  TData,
  TVariables extends OperationVariables
> = ApolloReact.MutationFunctionOptions<TData, TVariables> & OfflineOptions<TData>;

type ApolloMutationTuple<TData, TVariables extends OperationVariables> = ApolloReact.MutationTuple<
  TData,
  TVariables
>;

export type MutationTuple<TData, TVariables extends OperationVariables> = [
  (
    options?: MutationFunctionOptions<TData, TVariables>
  ) => ReturnType<ApolloMutationTuple<TData, TVariables>[0]>,
  ApolloMutationTuple<TData, TVariables>[1]
];

export type SubscriptionHookOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> = ApolloReact.SubscriptionHookOptions<TData, TVariables> & OfflineOptions<TData>;

export const useMutation = <
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  mutation: DocumentNode,
  {
    updateQuery,
    idField,
    operationType,
    mapResultToUpdate,
    ...mutationHookOptions
  }: MutationHookOptions<TData, TVariables> = {} as MutationHookOptions<TData, TVariables>
): MutationTuple<TData, TVariables> => {
  const [mutationFunction, mutationResult] = ApolloReact.useMutation<TData, TVariables>(
    mutation,
    mutationHookOptions as ApolloReact.MutationHookOptions<TData, TVariables>
  );
  const enhancedMutationFunction = (
    mutationFunctionOptions?: MutationFunctionOptions<TData, TVariables>
  ) => {
    return mutationFunction(
      offline.getMutationOptions<TData, TVariables>({
        updateQuery,
        idField,
        operationType,
        mapResultToUpdate,
        ...mutationFunctionOptions
      } as offline.MutationOptions<TData, TVariables>) as any
    );
  };

  return [enhancedMutationFunction, mutationResult];
};

export const useSubscription = <
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  subscription: DocumentNode,
  subscriptionHookOptions: SubscriptionHookOptions<
    TData,
    TVariables
  > = {} as SubscriptionHookOptions<TData, TVariables>
): ReturnType<typeof ApolloReact.useSubscription<TData, TVariables>> => {
  return ApolloReact.useSubscription<TData, TVariables>(
    subscription,
    offline.getSubscriptionOptions(subscriptionHookOptions) as any
  );
};
