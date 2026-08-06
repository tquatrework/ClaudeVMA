import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/mail/mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const configValues: Record<string, unknown> = {
                SMTP_HOST: 'mail.infomaniak.com',
                SMTP_PORT: 465,
                SMTP_SECURE: 'true',
                SMTP_USER: 'contact@visioprof.fr',
                SMTP_PASSWORD: 'test-password',
                MAIL_FROM_NAME: 'VisioProf',
                MAIL_FROM_EMAIL: 'contact@visioprof.fr',
                FRONT_BASE_URL: 'https://visioprof.fr',
              };
              return configValues[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mockSendMail.mockClear();
  });

  describe('sendEmailVerification', () => {
    it('envoie un email de vérification avec le bon sujet et le lien correct', async () => {
      await service.sendEmailVerification('eleve@example.com', 'raw-token-abc');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('eleve@example.com');
      expect(callArgs.subject).toContain('Vérifiez votre adresse email');
      expect(callArgs.html).toContain('https://visioprof.fr/verify-email?token=raw-token-abc');
      expect(callArgs.html).toContain('Bonjour');
      expect(callArgs.from).toContain('contact@visioprof.fr');
    });

    it('ne propage pas une erreur SMTP (log silencieux)', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

      await expect(
        service.sendEmailVerification('test@example.com', 'token-xyz'),
      ).resolves.not.toThrow();
    });
  });

  describe('sendIdentifierRecovery', () => {
    it('envoie un email avec les identifiants listés', async () => {
      await service.sendIdentifierRecovery('parent@example.com', ['jean.dupont', 'j.dupont.2']);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('parent@example.com');
      expect(callArgs.subject).toContain('identifiant');
      expect(callArgs.html).toContain('jean.dupont');
      expect(callArgs.html).toContain('j.dupont.2');
    });

    it('ne propage pas une erreur SMTP (log silencieux)', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

      await expect(
        service.sendIdentifierRecovery('test@example.com', ['user.1']),
      ).resolves.not.toThrow();
    });
  });

  describe('sendPasswordReset', () => {
    it('envoie un email de reset avec le bon lien', async () => {
      await service.sendPasswordReset('formateur@example.com', 'reset-token-xyz');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('formateur@example.com');
      expect(callArgs.subject).toContain('Réinitialisation');
      expect(callArgs.html).toContain('https://visioprof.fr/reset-password?token=reset-token-xyz');
      expect(callArgs.html).toContain('Bonjour');
    });

    it('ne propage pas une erreur SMTP (log silencieux)', async () => {
      mockSendMail.mockRejectedValue(new Error('Authentication failed'));

      await expect(
        service.sendPasswordReset('test@example.com', 'token-xyz'),
      ).resolves.not.toThrow();
    });
  });
});
