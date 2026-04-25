import {
  ICommentDocument,
  ICommentJob,
  ICommentNameList,
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
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
      ],
    );

    return commentsNamesList;
  }
}

export const commentService = new CommentService();
