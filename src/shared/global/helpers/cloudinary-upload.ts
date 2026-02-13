import cloudinary, {
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';

export function uploads(
  file: string,
  public_id?: string,
  overwrite?: boolean,
  invalidate?: boolean,
): Promise<UploadApiResponse | UploadApiErrorResponse | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise((resolve, _reject) => {
    cloudinary.v2.uploader.upload(
      file,
      {
        public_id,
        overwrite,
        invalidate,
      },
      (
        err: UploadApiErrorResponse | undefined,
        result: UploadApiResponse | undefined,
      ) => {
        if (err) {
          resolve(err);
        }
        resolve(result);
      },
    );
  });
}
