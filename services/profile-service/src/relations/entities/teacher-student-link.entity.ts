import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Links a formateur to a student (eleve).
 * PROF-BR-007: a teacher can be isPrincipalTeacher = true for a student.
 * PROF-FB-003: a formateur may only read profiles of students they are linked to.
 */
@Entity('teacher_student_links')
@Unique(['teacherId', 'studentId'])
export class TeacherStudentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'teacher_id' })
  teacherId: string;

  @Column('uuid', { name: 'student_id' })
  studentId: string;

  /** PROF-BR-007: marks the primary (référent) teacher for this student */
  @Column({ name: 'is_principal_teacher', default: false })
  isPrincipalTeacher: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
