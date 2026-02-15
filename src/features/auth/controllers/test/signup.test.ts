import { Request, Response } from 'express';
import * as cloudinaryUploads from '@global/helpers/cloudinary-upload';
import {
  authMock,
  authMockRequest,
  authMockResponse,
} from '@root/mocks/auth.mock';
import { SignUp } from '../signup';
import { CustomError } from '@global/helpers/error-handler';
import { authService } from '@service/db/auth.service';
import { UserCache } from '@service/redis/user.cache';

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/user.cache');
jest.mock('@service/queues/user.queue');
jest.mock('@service/queues/auth.queue');
jest.mock('@global/helpers/cloudinary-upload');

describe('SignUp', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if username is not available', async () => {
    const req: Request = authMockRequest(
      {},
      {
        username: '',
        email: 'test@gmail.com',
        password: 'password',
        avatarColor: 'red',
        avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      },
    ) as Request;
    const res: Response = authMockResponse();

    await SignUp.prototype.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual(
        'Please provide username',
      );
    });
  });

  it('should throw an error if username length is less than minimum length', async () => {
    const req: Request = authMockRequest(
      {},
      {
        username: 'us',
        email: 'test@gmail.com',
        password: 'password',
        avatarColor: 'red',
        avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      },
    ) as Request;
    const res: Response = authMockResponse();

    await SignUp.prototype.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual(
        'Username must be at least 3 characters long',
      );
    });
  });

  it('should throw an error if username length is greater than maximum length', async () => {
    const req: Request = authMockRequest(
      {},
      {
        username: 'mathematicsaaaa',
        email: 'test@gmail.com',
        password: 'password',
        avatarColor: 'red',
        avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      },
    ) as Request;
    const res: Response = authMockResponse();

    await SignUp.prototype.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual(
        'Username must be less than 12 characters long',
      );
    });
  });

  it('should throw an error if email is not valid', async () => {
    const req: Request = authMockRequest(
      {},
      {
        username: 'mathematicsaaaa',
        email: 'test',
        password: 'password',
        avatarColor: 'red',
        avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      },
    ) as Request;
    const res: Response = authMockResponse();

    await SignUp.prototype.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Email is not valid');
    });
  });

  it('should throw an error if email is not available', async () => {
    const req: Request = authMockRequest(
      {},
      {
        username: 'mathematicsaaaa',
        email: '',
        password: 'password',
        avatarColor: 'red',
        avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      },
    ) as Request;
    const res: Response = authMockResponse();

    await SignUp.prototype.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual(
        'Email is a required field',
      );
    });
  });

  it('should throw unauthorize error is user already exist', async () => {
    const req: Request = authMockRequest(
      {},
      {
        username: 'Manny',
        email: 'manny@test.com',
        password: 'qwerty',
        avatarColor: 'red',
        avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      },
    ) as Request;
    const res: Response = authMockResponse();

    jest
      .spyOn(authService, 'getUserByUsernameOrEmail')
      .mockResolvedValue(authMock);

    await SignUp.prototype.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(401);
      expect(error.serializeErrors().message).toEqual('Unauthorized');
    });
  });

  it('should set session data for valid credentials and send correct json response', async () => {
    const req: Request = authMockRequest(
      {},
      {
        username: 'Manny',
        email: 'manny@test.com',
        password: 'qwerty',
        avatarColor: 'red',
        avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
      },
    ) as Request;
    const res: Response = authMockResponse();

    jest
      .spyOn(authService, 'getUserByUsernameOrEmail')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue(null as any);

    const userSpy = jest.spyOn(UserCache.prototype, 'saveUserToCache');
    jest
      .spyOn(cloudinaryUploads, 'uploads')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((): any =>
        Promise.resolve({ version: '123124123', public_id: '123456' }),
      );

    await SignUp.prototype.create(req, res);
    console.log(userSpy.mock);
    expect(req.session?.token).toBeDefined();
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created successfully',
      user: userSpy.mock.calls[0][2],
      token: req.session?.jwt,
    });
  });
});
