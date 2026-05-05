import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DriverTripOffers } from './driver_trip_offers.entity';
import { Repository } from 'typeorm';
import { CreateDriverTripOffersDto } from './dto/create_driver_trip_offers.dto';

@Injectable()
export class DriverTripOffersService {
  constructor(@InjectRepository(DriverTripOffers) private driverTripOffersRepository: Repository<DriverTripOffers>) {}

  create(driverTripOffer: CreateDriverTripOffersDto) {
    const newData = this.driverTripOffersRepository.create(driverTripOffer);
    return this.driverTripOffersRepository.save(newData);
  }

  findByClientRequest(id_trip: number) {
    return this.driverTripOffersRepository.find({
      where: { id_trip },
      relations: ['passenger', 'trip'],
      order: { created_at: 'DESC' },
    });
  }

  findByPassenger(id_passenger: number) {
    return this.driverTripOffersRepository.find({
      where: { id_passenger },
      relations: ['trip', 'trip.driver'],
      order: { created_at: 'DESC' },
    });
  }
}
