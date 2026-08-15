import { IsLatitude, IsLongitude } from 'class-validator';

export class UpdateSosLocationDto {
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}
