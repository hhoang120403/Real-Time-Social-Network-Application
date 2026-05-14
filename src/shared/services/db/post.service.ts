import {
  IGetPostsQuery,
  IPostDocument,
} from '@post/interfaces/post.interface';
import { CollectionModel } from '@collections/models/collection.schema';
import { CommentsModel } from '@comment/models/comment.schema';
import { PostModel } from '@post/models/post.schema';
import { ReactionModel } from '@reaction/models/reaction.schema';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import mongoose, { UpdateQuery } from 'mongoose';

class PostService {
  public async addPostToDB(
    userId: string,
    createdPost: IPostDocument,
  ): Promise<void> {
    const post: Promise<IPostDocument> = PostModel.create(createdPost);
    const user: UpdateQuery<IUserDocument> = UserModel.updateOne(
      { _id: userId },
      { $inc: { postsCount: 1 } },
    );
    Promise.all([post, user]);
  }

  public async getPosts(
    query: IGetPostsQuery,
    skip = 0,
    limit = 0,
    sort: Record<string, 1 | -1>,
  ): Promise<IPostDocument[]> {
    let postQuery = {};
    if (query?.imgId && query?.gifUrl) {
      postQuery = { $or: [{ imgId: { $ne: '' } }, { gifUrl: { $ne: '' } }] };
    } else if (query?.videoId) {
      postQuery = { videoId: { $ne: '' } };
    } else {
      postQuery = query;
    }

    const posts: IPostDocument[] = await PostModel.aggregate([
      {
        $match: postQuery,
      },
      {
        $sort: sort,
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);

    return posts;
  }

  public async hydrateCommentsCount(posts: IPostDocument[]): Promise<IPostDocument[]> {
    if (!posts.length) {
      return posts;
    }

    const postIds = posts
      .map((post) => post._id?.toString())
      .filter((postId) => mongoose.Types.ObjectId.isValid(postId))
      .map((postId) => new mongoose.Types.ObjectId(postId));

    if (!postIds.length) {
      return posts;
    }
    const commentCounts = await CommentsModel.aggregate([
      {
        $match: {
          postId: { $in: postIds },
        },
      },
      {
        $project: {
          postId: 1,
          total: {
            $add: [
              1,
              {
                $size: {
                  $ifNull: ['$replies', []],
                },
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$postId',
          count: { $sum: '$total' },
        },
      },
    ]);

    const countMap = new Map(
      commentCounts.map((item) => [item._id.toString(), item.count]),
    );

    return posts.map((post) => ({
      ...post,
      commentsCount: countMap.get(post._id.toString()) || 0,
    })) as unknown as IPostDocument[];
  }

  public async postsCount(): Promise<number> {
    const count: number = await PostModel.find({}).countDocuments();
    return count;
  }

  public async deletePost(postId: string, _userId: string): Promise<void> {
    const targetPost = await PostModel.findById(postId).lean();
    if (!targetPost) {
      return;
    }

    const postObjectId = new mongoose.Types.ObjectId(postId);
    const sharedPostIds = await PostModel.find({
      $or: [
        { 'sharedPost._id': postObjectId },
        { 'sharedPost._id': postId },
      ],
    }).distinct('_id');
    const deletedPostIds = [postObjectId, ...sharedPostIds];
    const deletedPostIdsAsStrings = deletedPostIds.map((id) => id.toString());

    const postsByOwner = await PostModel.aggregate([
      {
        $match: {
          _id: { $in: deletedPostIds },
        },
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
        },
      },
    ]);

    const ownerCountUpdates = postsByOwner.map((owner) =>
      UserModel.updateOne(
        { _id: owner._id },
        { $inc: { postsCount: -owner.count } },
      ),
    );

    const targetSharedPostId = targetPost.sharedPost?._id?.toString();
    const shouldDecrementOriginalShare =
      targetSharedPostId &&
      mongoose.Types.ObjectId.isValid(targetSharedPostId) &&
      !deletedPostIdsAsStrings.includes(targetSharedPostId);

    await Promise.all([
      PostModel.deleteMany({ _id: { $in: deletedPostIds } }),
      ReactionModel.deleteMany({ postId: { $in: deletedPostIdsAsStrings } }),
      CommentsModel.deleteMany({ postId: { $in: deletedPostIdsAsStrings } }),
      CollectionModel.updateMany(
        {},
        { $pull: { posts: { $in: deletedPostIds } } },
      ),
      ...ownerCountUpdates,
      shouldDecrementOriginalShare
        ? PostModel.updateOne(
            { _id: targetSharedPostId },
            { $inc: { sharesCount: -1 } },
          )
        : Promise.resolve(),
    ]);
  }

  public async editPost(
    postId: string,
    updatedPost: IPostDocument,
  ): Promise<void> {
    const post: UpdateQuery<IPostDocument> = PostModel.updateOne(
      { _id: postId },
      { $set: updatedPost },
    );
    Promise.all([post]);
  }
}

export const postService: PostService = new PostService();
