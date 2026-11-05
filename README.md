# Apollo Client

A drop-in replacement
for [@apollo/client](https://www.apollographql.com/docs/react/get-started/) with automatic cache
updates. It will update apollo cache based on a mutation or subscription result.

## Install

```
pnpm add @dnevzorov/apollo-client @apollo/client
```

Supports `@apollo/client` 3.7+ and 4. With Apollo Client 4, also install its `rxjs` peer.

The package re-exports everything from `@apollo/client` and `@apollo/client/react`, so it covers
the React API in both majors. Apollo Client 4 removed some APIs, for example `ApolloError`; see the
[Apollo Client 4 migration guide](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration).

In plain Node ESM (no bundler, no Vitest) the package needs Apollo Client 4. Apollo Client 3 has
no `exports` map, so Node ESM cannot load its React entry point. CommonJS (`require`) works with
both majors.

## Setup

```typescript jsx
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ApolloClient, ApolloProvider, HttpLink, InMemoryCache} from '@dnevzorov/apollo-client';

const client = new ApolloClient({
  link: new HttpLink({uri: 'http://localhost:8080/graphql'}),
  cache: new InMemoryCache()
});

const App = () => (
  <ApolloProvider client={client}>
    <div>
      <h2>My first Apollo app 🚀</h2>
    </div>
  </ApolloProvider>
);

createRoot(document.getElementById('root')!).render(<App />);
```

## Mutations

This package
extends [useMutation](https://www.apollographql.com/docs/react/api/react/hooks/#options-2) options
allowing to update cached queries in one line of code instead of writing complex `update` functions.

For example this code

```typescript jsx
import React from 'react';
import {useMutation, useQuery} from '@dnevzorov/apollo-client';
import {createTodoMutation, todosQuery} from './api/operations';
import {TodosList} from './TodosList';

export const Todos = () => {
  const {data} = useQuery(todosQuery);
  const todos = data?.todos || [];

  const [createTodo] = useMutation(createTodoMutation, {
    updateQuery: todosQuery // <== pass a gql query you want to update
  });

  const handleCreateTodo = () => {
    return createTodo({
      variables: {
        task: 'New todo',
        createdAt: new Date().toISOString()
      }
    });
  };

  return (
    <div>
      <button onClick={handleCreateTodo}>Create todo</button>
      <TodosList todos={todos} />
    </div>
  );
};
```

is equivalent to

```typescript jsx
import React from 'react';
import {useMutation, useQuery} from '@apollo/react-hooks';
import {createTodoMutation, todosQuery} from './api/operations';
import {TodosList} from './TodosList';

export const Todos = () => {
  const {data} = useQuery(todosQuery);
  const todos = data?.todos || [];

  const [createTodo] = useMutation(createTodoMutation);

  const handleCreateTodo = () => {
    return createTodo({
      variables: {
        task: 'New todo',
        createdAt: new Date().toISOString()
      },
      update: (proxy, {data}) => {
        const newTodo = data.createTodo;
        try {
          const cache = proxy.readQuery({query: todosQuery});
          proxy.writeQuery({
            query: todosQuery,
            data: {
              todos: [...cache.todos, newTodo]
            }
          });
        } catch (error) {
          console.log(error);
        }
      }
    });
  };

  return (
    <div>
      <button onClick={handleCreateTodo}>Create todo</button>
      <TodosList todos={todos} />
    </div>
  );
};
```

And this code

```typescript jsx
import React from 'react';
import {useMutation} from '@dnevzorov/apollo-client';
import {Todo} from './api/generated';
import {deleteTodoMutation, todosQuery, updateTodoMutation} from './api/operations';

type Props = {
  todo: Todo;
};

export const Todo: React.FC<Props> = ({todo}) => {
  const [deleteTodo] = useMutation(deleteTodoMutation, {
    updateQuery: todosQuery,

    // to delete an item we need to provide it's id
    // if our api simply returns true when item is deleted
    // we need to return an id explicitly
    mapResultToUpdate: data => todo
  });
  const [updateTodo] = useMutation(updateTodoMutation);

  const handleDeleteTodo = () => {
    return deleteTodo({
      variables: {id: todo.id}
    });
  };

  const handleUpdateTodo = () => {
    return updateTodo({
      variables: {id: todo.id, done: !todo.done}
    });
  };

  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={handleUpdateTodo} />
      {todo.task}
      <button onClick={handleDeleteTodo}>delete</button>
    </li>
  );
};
```

is equivalent to

```typescript jsx
import React from 'react';
import {useMutation} from '@apollo/react-hooks';
import {Todo} from './api/generated';
import {deleteTodoMutation, todosQuery, updateTodoMutation} from './api/operations';

type Props = {
  todo: Todo;
};

export const Todo: React.FC<Props> = ({todo}) => {
  const [deleteTodo] = useMutation(deleteTodoMutation);
  const [updateTodo] = useMutation(updateTodoMutation);

  const handleDeleteTodo = () => {
    return deleteTodo({
      variables: {id: todo.id},
      update: proxy => {
        try {
          const cache = proxy.readQuery({query: todosQuery});
          proxy.writeQuery({
            query: todosQuery,
            data: {
              todos: cache.todos.filter(item => item.id !== todo.id)
            }
          });
        } catch (error) {
          console.log(error);
        }
      }
    });
  };

  const handleUpdateTodo = () => {
    // apollo client is clever enough to update an item in cache
    // although if you want to update an item with different type you'll have to write
    // a manual update function
    return updateTodo({
      variables: {id: todo.id, done: !todo.done}
    });
  };

  return (
    <li>
      <input type="checkbox" checked={todo.done} onClick={handleUpdateTodo} />
      {todo.task}
      <button onClick={handleDeleteTodo}>delete</button>
    </li>
  );
};
```

## `useMutation` offline options

| Option              | Description                                                                                                                                                                                                                                                                          | Default               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `updateQuery`       | A graphql query (wrapped in `gql` tag) that should be updated. You can pass query directly or specify it with variables `{query: todosQuery, variables: {limit: 10}}`                                                                                                                |
| `updatePath`        | Overrides a path inside the query where the item should be updated. For example if your query has structure like `{items: [...], total: 10}`, you can specify `updatePath: ['items']`. In most cases it is automatically detected. Pass `[]` to update data in the root query object |
| `idField`           | Unique field that is used to find the item in cache. It should be present in the mutation response                                                                                                                                                                                   | `id`                  |
| `operationType`     | Indicates what type of the operation should be performed e.g. add/remove/update item. By default operation type is automatically detected from mutation name e.g. `createTodo` will result in `OperationTypes.ADD`.                                                                  | `OperationTypes.AUTO` |
| `mapResultToUpdate` | A function that receives mutation result and returns an updated item. Function result should contain at least an id field                                                                                                                                                            |

[Other `useMutation` hook options](https://www.apollographql.com/docs/react/api/react/hooks/#options-2)

Offline options can be passed to the `useMutation` hook or to the mutation function directly.

```typescript jsx
const [deleteTodo] = useMutation(deleteTodoMutation, {
  updateQuery: todosQuery,
  mapResultToUpdate: data => todo
});

const handleDeleteTodo = () => {
  return deleteTodo({
    variables: {id: todo.id}
  });
};
```

is the same as

```typescript jsx
const [deleteTodo] = useMutation(deleteTodoMutation);

const handleDeleteTodo = () => {
  return deleteTodo({
    variables: {id: todo.id},
    updateQuery: todosQuery,
    mapResultToUpdate: data => todo
  });
};
```

## Subscriptions

`useSubscription` accepts the same offline options as `useMutation`. It updates the cache through
the `onData` option. If you pass your own `onData` (or `onSubscriptionData` in Apollo Client 3), the
automatic cache update is off.

```typescript jsx
useSubscription(onTodoUpdate, {updateQuery: todosQuery});
```

[Other `useSubscription` hook options](https://www.apollographql.com/docs/react/api/react/hooks/#options-3)

## Customize default configurations

Default configurations can be customized by calling `setOfflineConfig`

```typescript jsx
import {setOfflineConfig} from '@dnevzorov/apollo-client';

setOfflineConfig({
  getIdFieldFromObject(item: any) {
    switch (item.__typename) {
      case 'Todo':
        return 'id';
      case 'User':
        return 'user_id';
    }
  }
});
```

## Configuration options

| Option                 | Description                                                                                                          | Default                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `idField`              | Unique field that is used to find the item in cache. It should be present in the mutation response                   | `id`                                  |
| `getIdFieldFromObject` | A function that receives updated item and returns an id field name. If defined it will tke precedence over `idField` |
| `prefixesForRemove`    | A list of mutation name prefixes that will result in remove operation                                                | [prefixesForRemove](src/const.ts#L8)  |
| `prefixesForUpdate`    | A list of mutation name prefixes that will result in update operation                                                | [prefixesForUpdate](src/const.ts#L19) |
| `prefixesForAdd`       | A list of mutation name prefixes that will result in add operation                                                   | [prefixesForAdd](src/const.ts#L32)    |

## Update Apollo cache directly

This package also exposes `updateApolloCache` function directly, that can be used to build custom
implementations

Example

```typescript
import {updateApolloCache} from '@dnevzorov/apollo-client';

const newTodo = {
  __typename: 'Todo',
  id: 1,
  task: 'New todo',
  done: false,
  createdAt: new Date().toISOString()
};

updateApolloCache({
  client,
  data: {createTodo: newTodo},
  updateQuery: todosQuery
});
```

Function signature

```typescript
type OfflineOptions<TData> = {
  updateQuery?: QueryWithVariables | DocumentNode;
  idField?: string;
  operationType?: OperationTypes;
  mapResultToUpdate?(data: NonNullable<TData>): Item;
};

// ApolloClient or ApolloCache
type CacheProxy = {
  readQuery(options: {query: DocumentNode; variables?: any}): any;
  writeQuery(options: {query: DocumentNode; variables?: any; data: any}): any;
};

type UpdateCacheOptions<TData = any> = OfflineOptions<TData> & {
  client: CacheProxy;
  data: TData;
};

const updateApolloCache: <TData = any>({
  client,
  data,
  idField,
  updateQuery,
  operationType,
  mapResultToUpdate
}: UpdateCacheOptions<TData>) => void;
```

## Credits

This package is based
on [Amplify Offline Helpers](https://github.com/awslabs/aws-mobile-appsync-sdk-js/blob/master/OFFLINE_HELPERS.md)
