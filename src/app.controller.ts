import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * AppController - expone el health check en GET /health
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}

