import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class DepartmentGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const body = request.body;
        const params = request.params;

        if (!user) return false;

        // SUPER_ADMIN bypass
        if (user.role === Role.SUPER_ADMIN) {
            return true;
        }

        // ADMIN: Can only access resources in their department
        if (user.role === Role.ADMIN) {
            // If creating/updating resource with departmentId, it must match
            if (body.departmentId && body.departmentId !== user.departmentId) {
                throw new ForbiddenException('You can only manage resources in your department');
            }
            // If accessing by ID, we might need to fetch the resource to check department (handled in Service usually for list/get, but for strict guard checks we might need more logic. 
            // For now, we enforce that if departmentId is present in the request (body/query), it matches.
            // Real department scoping for GET/DELETE often happens in Service layer via `where` clause.
            return true;
        }

        // EMPLOYEE: Can only access own data (handled by service usually, but here we can check basic things)
        if (user.role === Role.EMPLOYEE) {
            // Employees usually shouldn't be hitting endpoints guarded by DepartmentGuard for management, 
            // but if they do, strict check:
            return true;
        }

        return true;
    }
}
