import { Types } from 'mongoose';
import { Notification, type INotification } from '../models/Notification';

type NotifyParams = {
  tenantId: Types.ObjectId | string;
  recipientId: Types.ObjectId | string;
  type: INotification['type'];
  title: string;
  body: string;
  link?: string;
};

export async function notify(params: NotifyParams): Promise<void> {
  try {
    await Notification.create({
      tenantId:    params.tenantId,
      recipientId: params.recipientId,
      type:        params.type,
      title:       params.title,
      body:        params.body,
      link:        params.link,
    });
  } catch {
    // fire-and-forget — never throws
  }
}
