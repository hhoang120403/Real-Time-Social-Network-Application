import { IFileImageDocument } from '@image/interfaces/image.interface';
import { imageService } from '@service/db/image.service';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

export class GetImagesController {
  public async getImages(req: Request, res: Response): Promise<void> {
    const images: IFileImageDocument[] = await imageService.getImages(
      req.params.userId as string,
    );
    res.status(HTTP_STATUS.OK).json({ message: 'User images', images });
  }
}
