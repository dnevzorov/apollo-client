import {render, screen, waitFor} from '@testing-library/react';
import * as Direct from '@apollo/client/react';
import {of} from 'rxjs';
import {expect, test} from 'vitest';
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  gql,
  InMemoryCache,
  Observable,
  useMutation,
  useQuery
} from '@dnevzorov/apollo-client';

const postsQuery = gql`
  query posts {
    posts {
      id
      title
    }
  }
`;
const createPost = gql`
  mutation createPost {
    createPost {
      id
      title
    }
  }
`;

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: new ApolloLink((operation) =>
    // Apollo Client 3 links return its own Observable; Apollo Client 4 links return an RxJS one.
    ((Observable as any)?.of ?? of)(
      operation.operationName === 'posts'
        ? {data: {posts: [{__typename: 'Post', id: 1, title: 'one'}]}}
        : {data: {createPost: {__typename: 'Post', id: 2, title: 'two'}}}
    )
  )
});

const Posts = () => {
  const wrapped = useQuery<any>(postsQuery);
  const direct = Direct.useQuery<any>(postsQuery);
  const [create] = useMutation(createPost, {updateQuery: postsQuery});
  return (
    <button onClick={() => create()}>
      {`${wrapped.data?.posts.length ?? '-'}/${direct.data?.posts.length ?? '-'}`}
    </button>
  );
};

// A second Apollo Client instance gives the wrapper's ApolloProvider a context that the hooks of
// @apollo/client cannot read.
test('the wrapper and @apollo/client share one Apollo Client instance', async () => {
  expect(ApolloProvider).toBe(Direct.ApolloProvider);

  render(
    <ApolloProvider client={client}>
      <Posts />
    </ApolloProvider>
  );
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('1/1'));

  screen.getByRole('button').click();
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('2/2'));
});
