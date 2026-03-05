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
import { UserCache } from '@service/redis/user.cache';
import { socketIONotificationObject } from '@socket/notification';
import { IUserDocument } from '@user/interfaces/user.interface';
import mongoose, { Query } from 'mongoose';

const userCache: UserCache = new UserCache();

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

    const user: Promise<IUserDocument> = userCache.getUserFromCache(
      userTo,
    ) as Promise<IUserDocument>;

    const result: [ICommentDocument, IPostDocument, IUserDocument] =
      await Promise.all([comments, post, user]);

    // Send comments notification
    if (result[2].notifications.comments && userFrom !== userTo) {
      const notificationModel: INotificationDocument = new NotificationModel();
      const notifications = await notificationModel.insertNotification({
        userFrom,
        userTo,
        message: `${username} commented on your post`,
        notificationType: 'comment',
        entityId: new mongoose.Types.ObjectId(postId),
        createdItemId: new mongoose.Types.ObjectId(result[0]._id),
        createdAt: new Date(),
        comment: comment.comment,
        reaction: '',
        post: result[1].post!,
        imgId: result[1].imgId!,
        imgVersion: result[1].imgVersion!,
        gifUrl: result[1].gifUrl!,
      });

      // Send to client with socketio
      socketIONotificationObject.emit('insert notification', notifications, {
        userTo,
      });

      // Send to email queue
      const templateParams: INotificationTemplate = {
        username: result[2].username!,
        header: 'Comment Notification',
        message: `${username} commented on your post`,
      };

      const template: string =
        notificationTemplate.notificationMessageTemplate(templateParams);

      emailQueue.addEmailJob('commentsEmail', {
        template,
        receiverEmail: result[2].email!,
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
