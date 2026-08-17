package com.library.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

@Service
public class MailService {
    private final Optional<JavaMailSender> mailSender;
    private final String mailHost;
    private final String mailFrom;
    private final String mailUsername;
    private final String mailPassword;
    private final String frontendUrl;

    public MailService(
            Optional<JavaMailSender> mailSender,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${app.mail.from:}") String mailFrom,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl
    ) {
        this.mailSender = mailSender;
        this.mailHost = mailHost;
        this.mailFrom = mailFrom;
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
        this.frontendUrl = frontendUrl;
    }

    public Optional<String> sendPasswordReset(String recipient, String token) {
        String resetUrl = UriComponentsBuilder
                .fromUriString(frontendUrl.replaceAll("/+$", ""))
                .path("/reset-password")
                .fragment("token=" + token)
                .build()
                .toUriString();
        String sender = mailFrom.isBlank() ? mailUsername : mailFrom;

        if (!smtpReady(sender)) {
            logResetFallback(recipient, resetUrl, "SMTP chua duoc cau hinh day du");
            return Optional.of(resetUrl);
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(sender);
        message.setTo(recipient);
        message.setSubject("Smart Library - Dat lai mat khau");
        message.setText("Xin chao,\n\n"
                + "Ban vua yeu cau dat lai mat khau Smart Library.\n"
                + "Lien ket co hieu luc trong 15 phut:\n\n"
                + resetUrl + "\n\n"
                + "Neu ban khong yeu cau thao tac nay, hay bo qua email.\n\n"
                + "Smart Library");

        try {
            mailSender.get().send(message);
        } catch (MailException exception) {
            logResetFallback(recipient, resetUrl, exception.getMessage());
            return Optional.of(resetUrl);
        }
        return isLocalFrontend() ? Optional.of(resetUrl) : Optional.empty();
    }

    private boolean smtpReady(String sender) {
        return mailSender.isPresent()
                && !mailHost.isBlank()
                && !sender.isBlank()
                && !mailPassword.isBlank()
                && !"PASTE_GMAIL_APP_PASSWORD_HERE".equals(mailPassword);
    }

    private boolean isLocalFrontend() {
        return frontendUrl.startsWith("http://localhost:")
                || frontendUrl.startsWith("http://127.0.0.1:");
    }

    private void logResetFallback(String recipient, String resetUrl, String reason) {
        System.out.println("[Smart Library] Khong gui duoc email dat lai mat khau cho " + recipient + ": " + reason);
        System.out.println("[Smart Library] Link reset dung de test local: " + resetUrl);
    }
}
