import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the API health contract', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const controller = moduleRef.get(HealthController);

    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'qandeel-api',
    });
  });
});
