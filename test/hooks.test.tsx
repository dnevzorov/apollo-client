import * as Apollo from '@apollo/client';
import {act, renderHook, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {Observable as RxObservable} from 'rxjs';
import {getSubscriptionOptions} from '../src/offline.js';
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  gql,
  InMemoryCache,
  useMutation,
  useSubscription
} from '../src/index.js';
import {createPostMutation, postsQuery} from './operations.js';

// Apollo Client 3 links return its own Observable; Apollo Client 4 links return an RxJS one.
const Observable: typeof RxObservable = (Apollo as any).Observable ?? RxObservable;

const post = {
  __typename: 'post',
  id: 1,
  user_id: 1,
  title: 'A day on the beach',
  date: '2018-01-01'
};
const newPost = {__typename: 'post', id: 26, user_id: 11, title: 'New post', date: '2018-12-31'};

const onCreatePostSubscription = gql`
  subscription onCreatePost {
    onCreatePost {
      id
      user_id
      title
      date
    }
  }
`;

const createClient = (result: object) => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(
      () =>
        new Observable((observer) => {
          observer.next(result);
          observer.complete();
        }) as any
    )
  });
  client.writeQuery({query: postsQuery, data: {posts: [post]}});
  return client;
};

const wrapperFor =
  (client: ReturnType<typeof createClient>) =>
  ({children}: {children: ReactNode}) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );

test('useMutation updates updateQuery with the mutation result', async () => {
  const client = createClient({data: {createPost: newPost}});
  const {result} = renderHook(() => useMutation(createPostMutation, {updateQuery: postsQuery}), {
    wrapper: wrapperFor(client)
  });

  await act(() => result.current[0]({variables: {title: 'New post'}}));

  expect(client.readQuery({query: postsQuery})).toEqual({posts: [post, newPost]});
});

// Apollo Client 4 removed onSubscriptionData, so the cache update must go through onData.
test('useSubscription updates updateQuery with the subscription data', async () => {
  const client = createClient({data: {onCreatePost: newPost}});
  renderHook(() => useSubscription(onCreatePostSubscription, {updateQuery: postsQuery}), {
    wrapper: wrapperFor(client)
  });

  await waitFor(() =>
    expect(client.readQuery({query: postsQuery})).toEqual({posts: [post, newPost]})
  );
});

// Apollo Client 3 calls only onData when both callbacks are set, which would silence the
// caller's own onSubscriptionData.
test('getSubscriptionOptions keeps a caller onSubscriptionData without adding onData', () => {
  const onSubscriptionData = () => {};
  const options = getSubscriptionOptions({updateQuery: postsQuery, onSubscriptionData} as any);

  expect(options).toEqual({onSubscriptionData});
});
