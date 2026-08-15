import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString } from 'class-validator';

export class RegisterAdminDto {
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @IsNotEmpty()
    departmentName: string;

    @IsNotEmpty()
    firstName: string;

    @IsNotEmpty()
    lastName: string;

    @IsString()
    gender: 'MALE' | 'FEMALE' | 'OTHER';

    @IsOptional()
    phone?: string;

    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    emergencyContact?: string;

    @IsString()
    @IsOptional()
    permanentAddress?: string;

    @IsOptional()
    jobTitle?: string;

    @IsOptional()
    salary?: string;

    @IsOptional()
    joinDate?: string;

    @IsOptional()
    dob?: string;

    @IsOptional()
    bloodGroup?: string;
}
