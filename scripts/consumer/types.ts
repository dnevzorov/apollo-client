// Compiles the published declarations against the installed Apollo Client major.
import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  type MutationHookOptions,
  type MutationTuple,
  OperationTypes,
  setOfflineConfig,
  type SubscriptionHookOptions,
  updateApolloCache,
  useMutation,
  useSubscription
} from '@dnevzorov/apollo-client';

type Data = {createPost: {id: number}};
type Variables = {title: string};

const query = gql`
  query posts {
    posts {
      id
    }
  }
`;
const mutationOptions: MutationHookOptions<Data, Variables> = {
  updateQuery: query,
  operationType: OperationTypes.ADD
};
const subscriptionOptions: SubscriptionHookOptions<Data> = {
  updateQuery: {query, variables: {}},
  idField: 'id'
};

export const useAll = () => {
  const mutation: MutationTuple<Data, Variables> = useMutation<Data, Variables>(
    query,
    mutationOptions
  );
  const subscription = useSubscription<Data>(query, subscriptionOptions);
  return [mutation, subscription.data?.createPost.id];
};

const client = new ApolloClient({cache: new InMemoryCache(), link: ApolloLink.empty()});
updateApolloCache({client, data: {createPost: {id: 1}}, updateQuery: query});
setOfflineConfig({idField: '_id'});
