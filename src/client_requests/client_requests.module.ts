import { Module } from '@nestjs/common';
import { ClientRequestsService } from './client_requests.service';
import { ClientRequestsController } from './client_requests.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { ClientRequests } from './client_requests.entity';
import { DriverTripOffers } from 'src/driver_trip_offers/driver_trip_offers.entity';
import { AuditLogsModule } from 'src/audit_logs/audit_logs.module';

@Module({
  providers: [ClientRequestsService],
  controllers: [ClientRequestsController],
  imports: [TypeOrmModule.forFeature([ClientRequests, DriverTripOffers, User]), AuditLogsModule]
})
export class ClientRequestsModule {}
