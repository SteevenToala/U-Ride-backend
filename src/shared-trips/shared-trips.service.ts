import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SharedTrip } from './entities/shared-trip.entity';

@Injectable()
export class SharedTripsService {
  constructor(
    @InjectRepository(SharedTrip)
    private sharedTripsRepository: Repository<SharedTrip>,
  ) {}

  async create(createSharedTripDto: any) {
    const trip = this.sharedTripsRepository.create(createSharedTripDto);
    return await this.sharedTripsRepository.save(trip);
  }

  async findAll() {
    return await this.sharedTripsRepository.find({
      relations: ['driver'],
      order: { departure_time: 'ASC' },
    });
  }

  async findOne(id: number) {
    const trip = await this.sharedTripsRepository.findOne({
      where: { id },
      relations: ['driver'],
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado');
    return trip;
  }

  async findByDriver(id_driver: number) {
    return await this.sharedTripsRepository.find({
      where: { id_driver },
      relations: ['driver'],
      order: { departure_time: 'DESC' },
    });
  }

  async update(id: number, updateData: any) {
    const trip = await this.findOne(id);
    // Excluir 'id' del body para que TypeORM no sobreescriba la PK con null
    // (lo cual causaría un INSERT en lugar de UPDATE)
    const { id: _ignored, ...safeData } = updateData;
    this.sharedTripsRepository.merge(trip, safeData);
    return await this.sharedTripsRepository.save(trip);
  }

  async remove(id: number) {
    const trip = await this.findOne(id);
    // Los viajes finalizados no se pueden eliminar (son registro histórico)
    if (trip.status === 'FINISHED') {
      throw new BadRequestException(
        'No se puede eliminar un viaje que ya fue completado'
      );
    }
    await this.sharedTripsRepository.remove(trip);
    return { success: true };
  }
}
