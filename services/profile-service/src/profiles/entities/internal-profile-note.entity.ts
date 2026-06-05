import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * Internal notes written by RP or AdministrateurFinancier about any user.
 * PROF-BR-009/010 + PROF-FB-002: never exposed to eleve, parent_financeur or formateur.
 */
@Entity('internal_profile_notes')
export class InternalProfileNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'target_user_id' })
  targetUserId: string;

  @Column('uuid', { name: 'author_id' })
  authorId: string;

  @Column({
    name: 'author_role',
    type: 'enum',
    enum: UserRole,
  })
  authorRole: UserRole;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
