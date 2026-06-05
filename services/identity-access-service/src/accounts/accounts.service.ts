import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  User,
  UserRole,
  ValidationStatus,
  INTERNAL_ROLES,
  SELF_REGISTRATION_ROLES,
} from '../auth/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly events: EventsService,
  ) {}

  async createAccount(dto: CreateAccountDto, ipAddress?: string) {
    const role = dto.role ?? UserRole.ELEVE;

    if (INTERNAL_ROLES.includes(role)) {
      throw new ForbiddenException('Cannot self-register with an internal role (IAM-FB-002)');
    }

    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      role,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const saved = await this.userRepo.save(user);

    this.events.publish('AccountCreated', {
      userId: saved.id,
      email: saved.email,
      role: saved.role,
      ipAddress,
    });

    return this.toPublic(saved);
  }

  async getAccount(accountId: string) {
    const user = await this.findOrFail(accountId);
    return this.toPublic(user);
  }

  async updateRoles(accountId: string, dto: UpdateRolesDto, actor: User) {
    const target = await this.findOrFail(accountId);

    const canAssignInternal = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(actor.role);

    if (INTERNAL_ROLES.includes(dto.role) && !canAssignInternal) {
      throw new ForbiddenException('Only RP or TI can assign internal roles');
    }

    const oldRole = target.role;
    target.role = dto.role;
    await this.userRepo.save(target);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: target.id,
        actorId: actor.id,
        action: 'ROLE_CHANGED',
        oldValue: { role: oldRole },
        newValue: { role: dto.role },
      }),
    );

    this.events.publish('RoleChanged', {
      userId: target.id,
      oldRole,
      newRole: dto.role,
      actorId: actor.id,
    });

    return this.toPublic(target);
  }

  async validateAccount(accountId: string, actor: User) {
    const target = await this.findOrFail(accountId);

    const canValidate = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(actor.role);
    if (!canValidate) throw new ForbiddenException('Only RP or TI can validate accounts');

    if (!target.consentSigned) {
      throw new ForbiddenException('Account cannot be validated before mandatory consents are signed (IAM-FB-003)');
    }

    target.validationStatus = ValidationStatus.ACTIVE;
    await this.userRepo.save(target);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: target.id,
        actorId: actor.id,
        action: 'ACCOUNT_VALIDATED',
        oldValue: { validationStatus: ValidationStatus.PENDING },
        newValue: { validationStatus: ValidationStatus.ACTIVE },
      }),
    );

    this.events.publish('AccountValidated', { userId: target.id, actorId: actor.id });

    return this.toPublic(target);
  }

  async suspendAccount(accountId: string, actor: User) {
    if (actor.role !== UserRole.TECHNICIEN_INFORMATIQUE) {
      throw new ForbiddenException('Only TI can suspend accounts');
    }

    const target = await this.findOrFail(accountId);
    const old = target.validationStatus;

    target.validationStatus = ValidationStatus.SUSPENDED;
    target.isActive = false;
    await this.userRepo.save(target);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: target.id,
        actorId: actor.id,
        action: 'ACCOUNT_SUSPENDED',
        oldValue: { validationStatus: old },
        newValue: { validationStatus: ValidationStatus.SUSPENDED },
      }),
    );

    this.events.publish('AccountSuspended', { userId: target.id, actorId: actor.id });

    return this.toPublic(target);
  }

  async getAuditLogs(accountId: string) {
    await this.findOrFail(accountId);
    return this.auditRepo.find({
      where: { targetUserId: accountId },
      order: { createdAt: 'DESC' },
    });
  }

  private async findOrFail(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Account ${id} not found`);
    return user;
  }

  private toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      validationStatus: user.validationStatus,
      consentSigned: user.consentSigned,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
