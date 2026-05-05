import { Status } from "../client_requests.entity";

export class UpdateStatusClientRequestDto {
    id_trip: number;
    status: Status;    
}