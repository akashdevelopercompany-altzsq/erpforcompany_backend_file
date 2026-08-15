import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class DepartmentGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const body = request.body;
        const params = request.params;

        // Super Admin bypass
        if (user.role === Role.SUPER_ADMIN) return true;

        // Admin check
        if (user.role === Role.ADMIN) {
            // If accessing a resource with departmentId in body
            if (body.departmentId && body.departmentId !== user.departmentId) {
                throw new ForbiddenException('You can only manage your own department');
            }
            // If accessing a resource by ID (needs lookup, but for now assuming simple checks or service level checks)
            // This guard is a basic layer. Service level checks are more robust.
            return true;
        }

        return true;
    }
}
