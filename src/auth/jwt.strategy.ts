import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: any) => {
                    return request?.query?.token;
                },
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'super-secret-key-change-in-production',
        });
    }

    async validate(payload: any) {
        console.log('JwtStrategy validating payload:', payload);
        return {
            id: payload.sub || payload.id,
            email: payload.email,
            role: payload.role,
            departmentId: payload.departmentId
        };
    }
}
