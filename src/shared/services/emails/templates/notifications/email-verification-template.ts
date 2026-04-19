import fs from 'fs';
import ejs from 'ejs';

class EmailVerificationTemplate {
  public emailVerificationTemplate(username: string, verificationLink: string): string {
    return ejs.render(fs.readFileSync(__dirname + '/email-verification.ejs', 'utf8'), {
      username,
      verificationLink,
      image_url: 'https://w7.pngwing.com/pngs/120/102/png-transparent-padlock-logo-computer-icons-padlock-technic-password-padlock-thumbnail.png'
    });
  }
}

export const emailVerificationTemplate: EmailVerificationTemplate = new EmailVerificationTemplate();
