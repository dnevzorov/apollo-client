import {ApolloClient, ApolloLink, InMemoryCache} from '@apollo/client';
import {OperationTypes} from '../src/const.js';
import {
  getOperationFieldName,
  getOpTypeFromOperationName,
  getUpdater,
  offlineConfig,
  setConfig,
  updateCache
} from '../src/offline.js';
import {
  createPostMutation,
  deletePostMutation,
  featuredPostsQuery,
  postsQuery,
  updatePostMutation
} from './operations.js';

const defaultConfig = {...offlineConfig};

const post1 = Object.freeze({
  __typename: 'post',
  id: 1,
  user_id: 1,
  title: 'A day on the beach',
  date: '2018-01-01'
});

const post2 = Object.freeze({
  __typename: 'post',
  id: 24,
  user_id: 10,
  title: 'Coding for joy',
  date: '2018-12-24'
});

const post3 = Object.freeze({
  __typename: 'post',
  id: 25,
  user_id: 9,
  title: 'On the road',
  date: '2018-12-25'
});

const newPost = Object.freeze({
  __typename: 'post',
  id: 26,
  user_id: 11,
  title: 'New post',
  date: '2018-12-31'
});

const posts = Object.freeze([post1, post2, post3]);

test('getOpTypeFromOperationName', () => {
  expect(getOpTypeFromOperationName('createPost')).toBe(OperationTypes.ADD);
  expect(getOpTypeFromOperationName('newPost')).toBe(OperationTypes.ADD);
  expect(getOpTypeFromOperationName('insertPost')).toBe(OperationTypes.ADD);
  expect(getOpTypeFromOperationName('updatePost')).toBe(OperationTypes.UPDATE);
  expect(getOpTypeFromOperationName('editPost')).toBe(OperationTypes.UPDATE);
  expect(getOpTypeFromOperationName('removePost')).toBe(OperationTypes.REMOVE);
  expect(getOpTypeFromOperationName('deletePost')).toBe(OperationTypes.REMOVE);
});

describe('getUpdater', () => {
  test('updater should add item', () => {
    const updater = getUpdater(OperationTypes.ADD, 'id');
    expect(updater(posts, newPost)).toEqual([...posts, newPost]);
    expect(updater({}, newPost)).toEqual(newPost);
  });

  test('updater should remove item', () => {
    const updater = getUpdater(OperationTypes.REMOVE, 'id');
    expect(updater(posts, {id: 1})).toEqual([post2, post3]);
    expect(updater({}, {id: 1})).toBeNull();
  });

  test('updater should update item', () => {
    const updater = getUpdater(OperationTypes.UPDATE, 'id');
    const updatedPost = {id: post3.id, title: 'Updated post', __typename: 'post'};
    expect(updater(posts, updatedPost)).toEqual([post1, post2, {...post3, ...updatedPost}]);
    expect(updater(post3, updatedPost)).toEqual({...post3, title: 'Updated post'});
  });

  test('getOperationFieldName', () => {
    expect(getOperationFieldName(createPostMutation)).toBe('createPost');
    expect(getOperationFieldName(updatePostMutation)).toBe('updatePost');
    expect(getOperationFieldName(deletePostMutation)).toBe('deletePost');
  });
});

const createClient = () => new ApolloClient({cache: new InMemoryCache(), link: ApolloLink.empty()});

describe('updateCache', () => {
  let client: ReturnType<typeof createClient>;
  beforeEach(() => {
    client = createClient();
    client.writeQuery({
      query: postsQuery,
      data: {posts: [...posts]}
    });
  });

  test('should add item', () => {
    updateCache({
      client,
      data: {createPost: newPost},
      updateQuery: postsQuery
    });

    expect(client.readQuery({query: postsQuery})).toMatchSnapshot();
  });

  test('should not update empty query', () => {
    vi.spyOn(client, 'writeQuery');
    updateCache({
      client,
      data: {createPost: newPost},
      updateQuery: featuredPostsQuery
    });

    expect(client.writeQuery).not.toHaveBeenCalled();
  });

  test('should remove item', () => {
    updateCache({
      client,
      data: {deletePost: post3},
      updateQuery: postsQuery
    });

    expect(client.readQuery({query: postsQuery})).toMatchSnapshot();
  });

  test('should update item', () => {
    const updatedPost = {id: post3.id, title: 'Updated post', __typename: 'post'};
    updateCache({
      client,
      data: {updatePost: updatedPost},
      updateQuery: postsQuery
    });

    expect(client.readQuery({query: postsQuery})).toMatchSnapshot();
  });

  test('should update item with mapResultToUpdate', () => {
    const updatedPost = {id: post3.id, title: 'Updated post', __typename: 'post'};
    updateCache({
      client,
      data: {updatePost: updatedPost},
      mapResultToUpdate(data) {
        return {
          ...data.updatePost,
          title: data.updatePost.title + ' with mapResultToUpdate'
        };
      },
      updateQuery: postsQuery
    });

    expect(client.readQuery({query: postsQuery})).toMatchSnapshot();
  });

  test('should update item with custom id field', () => {
    const updatedPost = {user_id: post3.user_id, title: 'Updated post', __typename: 'post'};
    updateCache({
      client,
      data: {updatePost: updatedPost},
      updateQuery: postsQuery,
      idField: 'user_id'
    });

    expect(client.readQuery({query: postsQuery})).toMatchSnapshot();
  });

  describe('with custom config', () => {
    beforeEach(() => {
      setConfig(defaultConfig);
    });

    afterAll(() => {
      setConfig(defaultConfig);
    });

    test('should update item with idField in config', () => {
      setConfig({idField: 'user_id'});
      const updatedPost = {user_id: post3.user_id, title: 'Updated post', __typename: 'post'};
      updateCache({
        client,
        data: {updatePost: updatedPost},
        updateQuery: postsQuery
      });

      expect(client.readQuery({query: postsQuery})).toMatchSnapshot();
    });

    test('should update item with getIdFieldFromObject in config', () => {
      const getIdFieldFromObject = vi.fn(() => 'user_id');
      setConfig({getIdFieldFromObject});
      const updatedPost = {user_id: post3.user_id, title: 'Updated post', __typename: 'post'};
      updateCache({
        client,
        data: {updatePost: updatedPost},
        updateQuery: postsQuery
      });

      expect(client.readQuery({query: postsQuery})).toMatchSnapshot();
      expect(getIdFieldFromObject).toHaveBeenCalledWith(updatedPost);
    });
  });
});
