import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly frontBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'mail.infomaniak.com');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 465);
    const smtpSecure = this.configService.get<string>('SMTP_SECURE', 'true') === 'true';
    const smtpUser = this.configService.get<string>('SMTP_USER', 'contact@visioprof.fr');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD', '');

    this.fromName = this.configService.get<string>('MAIL_FROM_NAME', 'VisioProf');
    this.fromAddress = this.configService.get<string>('MAIL_FROM_EMAIL', 'contact@visioprof.fr');
    this.frontBaseUrl = this.configService.get<string>('FRONT_BASE_URL', 'https://visioprof.fr');

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });
  }

  /**
   * Envoie un email de vérification d'adresse après inscription.
   * Le lien pointe vers le front avec le token en query param.
   */
  async sendEmailVerification(
    toEmail: string,
    firstName: string | null,
    rawToken: string,
  ): Promise<void> {
    const verificationLink = `${this.frontBaseUrl}/verify-email?token=${rawToken}`;
    const recipientName = firstName ?? 'Utilisateur';

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Vérification de votre adresse email — VisioProf</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td>
        <table width="600" align="center" cellpadding="0" cellspacing="0"
               style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #2c3e50; font-size: 24px; margin: 0;">VisioProf</h1>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6;">
              <p>Bonjour ${recipientName},</p>
              <p>Merci de vous être inscrit sur VisioProf. Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous pour vérifier votre adresse email.</p>
              <p>Ce lien est valable <strong>24 heures</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 30px 0;">
              <a href="${verificationLink}"
                 style="background-color: #3498db; color: #ffffff; text-decoration: none;
                        padding: 14px 30px; border-radius: 5px; font-size: 16px; font-weight: bold;
                        display: inline-block;">
                Vérifier mon adresse email
              </a>
            </td>
          </tr>
          <tr>
            <td style="color: #666666; font-size: 14px; line-height: 1.6;">
              <p>Si vous n'arrivez pas à cliquer sur le bouton, copiez ce lien dans votre navigateur :</p>
              <p style="word-break: break-all; color: #3498db;">${verificationLink}</p>
              <p>Si vous n'avez pas créé de compte sur VisioProf, ignorez simplement cet email.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #999999; font-size: 12px; text-align: center;">
              <p>© ${new Date().getFullYear()} VisioProf — contact@visioprof.fr</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    await this.sendMail({
      to: toEmail,
      subject: 'Vérifiez votre adresse email — VisioProf',
      html: htmlContent,
    });
  }

  /**
   * Envoie un email de récupération d'identifiant(s) de connexion.
   */
  async sendIdentifierRecovery(
    toEmail: string,
    loginIdentifiers: string[],
  ): Promise<void> {
    const identifierListHtml = loginIdentifiers
      .map((identifier) => `<li style="padding: 4px 0; font-size: 16px;"><strong>${identifier}</strong></li>`)
      .join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Récupération de votre identifiant — VisioProf</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td>
        <table width="600" align="center" cellpadding="0" cellspacing="0"
               style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #2c3e50; font-size: 24px; margin: 0;">VisioProf</h1>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6;">
              <p>Bonjour,</p>
              <p>Vous avez demandé la récupération de votre identifiant de connexion. Voici le ou les identifiant(s) associés à cette adresse email :</p>
              <ul style="list-style-type: disc; padding-left: 20px; margin: 20px 0;">
                ${identifierListHtml}
              </ul>
              <p>Pour vous connecter, rendez-vous sur <a href="${this.frontBaseUrl}/login" style="color: #3498db;">VisioProf</a> et utilisez l'un de ces identifiants.</p>
            </td>
          </tr>
          <tr>
            <td style="color: #666666; font-size: 14px; line-height: 1.6;">
              <p>Si vous n'avez pas fait cette demande, ignorez simplement cet email. Votre compte est sécurisé.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #999999; font-size: 12px; text-align: center;">
              <p>© ${new Date().getFullYear()} VisioProf — contact@visioprof.fr</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    await this.sendMail({
      to: toEmail,
      subject: 'Votre identifiant de connexion VisioProf',
      html: htmlContent,
    });
  }

  /**
   * Envoie un email de réinitialisation de mot de passe.
   * Le lien pointe vers le front avec le token en query param.
   */
  async sendPasswordReset(
    toEmail: string,
    firstName: string | null,
    rawToken: string,
  ): Promise<void> {
    const resetLink = `${this.frontBaseUrl}/reset-password?token=${rawToken}`;
    const recipientName = firstName ?? 'Utilisateur';

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Réinitialisation de mot de passe — VisioProf</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td>
        <table width="600" align="center" cellpadding="0" cellspacing="0"
               style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="color: #2c3e50; font-size: 24px; margin: 0;">VisioProf</h1>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6;">
              <p>Bonjour ${recipientName},</p>
              <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
              <p>Ce lien est valable <strong>60 minutes</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 30px 0;">
              <a href="${resetLink}"
                 style="background-color: #e74c3c; color: #ffffff; text-decoration: none;
                        padding: 14px 30px; border-radius: 5px; font-size: 16px; font-weight: bold;
                        display: inline-block;">
                Réinitialiser mon mot de passe
              </a>
            </td>
          </tr>
          <tr>
            <td style="color: #666666; font-size: 14px; line-height: 1.6;">
              <p>Si vous n'arrivez pas à cliquer sur le bouton, copiez ce lien dans votre navigateur :</p>
              <p style="word-break: break-all; color: #3498db;">${resetLink}</p>
              <p>Si vous n'avez pas demandé de réinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #999999; font-size: 12px; text-align: center;">
              <p>© ${new Date().getFullYear()} VisioProf — contact@visioprof.fr</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    await this.sendMail({
      to: toEmail,
      subject: 'Réinitialisation de votre mot de passe — VisioProf',
      html: htmlContent,
    });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`Email envoyé à ${options.to} — sujet: ${options.subject}`);
    } catch (error) {
      this.logger.error(
        `Échec d'envoi d'email à ${options.to} — sujet: ${options.subject}`,
        error instanceof Error ? error.stack : String(error),
      );
      // On ne propage pas l'erreur SMTP au client pour ne pas révéler l'existence
      // ou l'inexistence d'une adresse email — l'appelant gère toujours une réponse neutre.
    }
  }
}
