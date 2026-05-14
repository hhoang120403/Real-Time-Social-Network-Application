import {
  ICommentDocument,
  ICommentJob,
  ICommentNameList,
  ICommentReaction,
  ICommentReply,
  IQueryComment,
} from '@comment/interfaces/comment.interface';
import { CommentsModel } from '@comment/models/comment.schema';
import {
  INotificationDocument,
  INotificationTemplate,
} from '@notification/interfaces/notification.interface';
import { NotificationModel } from '@notification/models/notification.schema';
import { IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { emailQueue } from '@service/queues/email.queue';
import { socketIONotificationObject } from '@socket/notification';
import { AuthModel } from '@auth/models/auth.schema';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import mongoose, { Query } from 'mongoose';

class CommentService {
  public async addCommentToDB(commentData: ICommentJob): Promise<void> {
    const { postId, userTo, userFrom, comment, username } = commentData;
    const comments: Promise<ICommentDocument> = CommentsModel.create(comment);
    const post: Query<IPostDocument, IPostDocument> =
      PostModel.findOneAndUpdate(
        { _id: postId },
        { $inc: { commentsCount: 1 } },
        { new: true },
      ) as unknown as Query<IPostDocument, IPostDocument>;

    const result: [ICommentDocument, IPostDocument] = await Promise.all([
      comments,
      post,
    ]);

    await this.sendCommentsNotifications({
      postId,
      postOwnerId: userTo,
      userFrom,
      username,
      comment: result[0],
      post: result[1],
    });
  }

  private async getCommentNotificationRecipients({
    postId,
    postOwnerId,
    userFrom,
    username,
  }: {
    postId: string;
    postOwnerId: string;
    userFrom: string;
    username: string;
  }): Promise<IUserDocument[]> {
    const currentUserId = `${userFrom}`;
    const recipientIds = new Set<string>();
    const commenterUsernames = new Set<string>();

    if (`${postOwnerId}` !== currentUserId) {
      recipientIds.add(`${postOwnerId}`);
    }

    const postComments: ICommentDocument[] = await CommentsModel.find({
      postId,
    }).exec();

    for (const postComment of postComments) {
      const commentUserFrom = postComment.userFrom
        ? `${postComment.userFrom}`
        : '';
      if (commentUserFrom && commentUserFrom !== currentUserId) {
        recipientIds.add(commentUserFrom);
      } else if (!commentUserFrom && postComment.username !== username) {
        commenterUsernames.add(postComment.username);
      }
    }

    const userIdMatches = Array.from(recipientIds)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const usernameMatches = Array.from(commenterUsernames);

    if (!userIdMatches.length && !usernameMatches.length) {
      return [];
    }

    return UserModel.aggregate([
      {
        $lookup: {
          from: AuthModel.collection.name,
          localField: 'authId',
          foreignField: '_id',
          as: 'auth',
        },
      },
      { $unwind: '$auth' },
      {
        $match: {
          $or: [
            { _id: { $in: userIdMatches } },
            { 'auth.username': { $in: usernameMatches } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          notifications: 1,
          username: '$auth.username',
          email: '$auth.email',
        },
      },
    ]) as Promise<IUserDocument[]>;
  }

  private async sendCommentsNotifications({
    postId,
    postOwnerId,
    userFrom,
    username,
    comment,
    post,
  }: {
    postId: string;
    postOwnerId: string;
    userFrom: string;
    username: string;
    comment: ICommentDocument;
    post: IPostDocument;
  }): Promise<void> {
    const recipients = await this.getCommentNotificationRecipients({
      postId,
      postOwnerId,
      userFrom,
      username,
    });

    for (const recipient of recipients) {
      if (
        !recipient?.notifications?.comments ||
        `${recipient._id}` === `${userFrom}`
      ) {
        continue;
      }

      const isPostOwner = `${recipient._id}` === `${postOwnerId}`;
      const notificationMessage = isPostOwner
        ? `${username} commented on your post`
        : `${username} also commented on a post`;

      const notificationModel: INotificationDocument = new NotificationModel();
      const notifications = await notificationModel.insertNotification({
        userFrom,
        userTo: `${recipient._id}`,
        message: notificationMessage,
        notificationType: 'comment',
        entityId: new mongoose.Types.ObjectId(postId),
        createdItemId: new mongoose.Types.ObjectId(comment._id),
        createdAt: new Date(),
        comment: comment.comment,
        reaction: '',
        post: post.post!,
        imgId: post.imgId!,
        imgVersion: post.imgVersion!,
        gifUrl: post.gifUrl!,
      });

      socketIONotificationObject.emit('insert notification', notifications, {
        userTo: `${recipient._id}`,
      });

      const templateParams: INotificationTemplate = {
        username: recipient.username!,
        header: 'Comment Notification',
        message: notificationMessage,
      };

      const template: string =
        notificationTemplate.notificationMessageTemplate(templateParams);

      emailQueue.addEmailJob('commentsEmail', {
        template,
        receiverEmail: recipient.email!,
        subject: 'Post Notification',
      });
    }
  }

  public async getPostCommentsFromDB(
    query: IQueryComment,
    sort: Record<string, 1 | -1>,
  ): Promise<ICommentDocument[]> {
    const comments: ICommentDocument[] = await CommentsModel.aggregate([
      {
        $match: query,
      },
      {
        $sort: sort,
      },
    ]);
    return comments;
  }

  public async getPostCommentNames(
    query: IQueryComment,
    sort: Record<string, 1 | -1>,
  ): Promise<ICommentNameList[]> {
    const commentsNamesList: ICommentNameList[] = await CommentsModel.aggregate(
      [
        {
          $match: query,
        },
        {
          $sort: sort,
        },
        {
          $group: {
            _id: null,
            names: { $addToSet: '$username' },
            count: {
              $sum: {
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
            replyNames: { $push: '$replies.username' },
          },
        },
        {
          $project: {
            names: {
              $setUnion: [
                '$names',
                {
                  $reduce: {
                    input: '$replyNames',
                    initialValue: [],
                    in: { $concatArrays: ['$$value', '$$this'] },
                  },
                },
              ],
            },
            count: 1,
          },
        },
        {
          $project: {
            _id: 0,
            names: 1,
            count: 1,
          },
        },
      ],
    );

    return commentsNamesList;
  }

  public async updateCommentReactionInDB(
    postId: string,
    commentId: string,
    reaction: ICommentReaction,
    previousReaction = '',
  ): Promise<ICommentDocument | null> {
    const comment = await CommentsModel.findOne({ _id: commentId, postId }).exec();
    if (!comment) {
      return null;
    }

    const reactions = comment.reactions || {
      like: 0,
      love: 0,
      happy: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };
    const reactionList = (comment.reactionList || []).filter(
      (item) => item.username !== reaction.username,
    );

    if (previousReaction && reactions[previousReaction as keyof typeof reactions] > 0) {
      reactions[previousReaction as keyof typeof reactions] -= 1;
    }

    if (previousReaction !== reaction.type) {
      reactions[reaction.type as keyof typeof reactions] =
        (reactions[reaction.type as keyof typeof reactions] || 0) + 1;
      reactionList.push(reaction);
    }

    comment.reactions = reactions;
    comment.reactionList = reactionList;
    await comment.save();
    return comment;
  }

  public async addCommentReplyToDB(
    postId: string,
    commentId: string,
    reply: ICommentReply,
  ): Promise<ICommentDocument | null> {
    const comment = await CommentsModel.findOneAndUpdate(
      { _id: commentId, postId },
      { $push: { replies: reply } },
      { new: true },
    ).exec();

    if (comment) {
      await PostModel.findOneAndUpdate(
        { _id: postId },
        { $inc: { commentsCount: 1 } },
        { new: true },
      ).exec();
    }

    return comment;
  }

  public async updateCommentReplyReactionInDB(
    postId: string,
    commentId: string,
    replyId: string,
    reaction: ICommentReaction,
    previousReaction = '',
  ): Promise<ICommentDocument | null> {
    const comment = await CommentsModel.findOne({ _id: commentId, postId }).exec();
    if (!comment) {
      return null;
    }

    const replies = [...(comment.replies || [])];
    const replyIndex = replies.findIndex((reply) => reply._id?.toString() === replyId);
    if (replyIndex === -1) {
      return comment;
    }

    const reply = replies[replyIndex];
    const reactions = reply.reactions || {
      like: 0,
      love: 0,
      happy: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };
    const reactionList = (reply.reactionList || []).filter(
      (item) => item.username !== reaction.username,
    );

    if (previousReaction && reactions[previousReaction as keyof typeof reactions] > 0) {
      reactions[previousReaction as keyof typeof reactions] -= 1;
    }

    if (previousReaction !== reaction.type) {
      reactions[reaction.type as keyof typeof reactions] =
        (reactions[reaction.type as keyof typeof reactions] || 0) + 1;
      reactionList.push(reaction);
    }

    replies[replyIndex] = { ...reply, reactions, reactionList };
    comment.replies = replies;
    await comment.save();
    return comment;
  }

  public async updateCommentTextInDB(
    postId: string,
    commentId: string,
    commentText: string,
  ): Promise<ICommentDocument | null> {
    const comment = await CommentsModel.findOneAndUpdate(
      { _id: commentId, postId },
      { $set: { comment: commentText } },
      { new: true },
    ).exec();

    return comment;
  }

  public async updateCommentReplyTextInDB(
    postId: string,
    commentId: string,
    replyId: string,
    commentText: string,
  ): Promise<ICommentDocument | null> {
    const comment = await CommentsModel.findOne({ _id: commentId, postId }).exec();
    if (!comment) {
      return null;
    }

    const replies = [...(comment.replies || [])];
    const replyIndex = replies.findIndex((reply) => reply._id?.toString() === replyId);
    if (replyIndex === -1) {
      return comment;
    }

    replies[replyIndex] = { ...replies[replyIndex], comment: commentText };
    comment.replies = replies;
    await comment.save();
    return comment;
  }

  public async deleteCommentReplyFromDB(
    postId: string,
    commentId: string,
    replyId: string,
  ): Promise<ICommentDocument | null> {
    const comment = await CommentsModel.findOne({ _id: commentId, postId }).exec();
    if (!comment) {
      return null;
    }

    const previousReplyCount = (comment.replies || []).length;
    comment.replies = (comment.replies || []).filter(
      (reply) => reply._id?.toString() !== replyId,
    );
    if (comment.replies.length === previousReplyCount) {
      return comment;
    }
    await comment.save();

    await PostModel.findOneAndUpdate(
      { _id: postId },
      { $inc: { commentsCount: -1 } },
      { new: true },
    ).exec();

    return comment;
  }

  public async deleteCommentFromDB(
    postId: string,
    commentId: string,
  ): Promise<ICommentDocument | null> {
    const comment = await CommentsModel.findOneAndDelete({
      _id: commentId,
      postId,
    }).exec();

    if (comment) {
      const deletedCommentsCount = 1 + (comment.replies || []).length;
      await PostModel.findOneAndUpdate(
        { _id: postId },
        { $inc: { commentsCount: -deletedCommentsCount } },
        { new: true },
      ).exec();
    }

    return comment;
  }
}

export const commentService = new CommentService();
