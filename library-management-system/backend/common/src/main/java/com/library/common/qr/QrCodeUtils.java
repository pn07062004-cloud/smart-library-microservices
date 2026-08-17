package com.library.common.qr;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;

public final class QrCodeUtils {
    private QrCodeUtils() {}

    public static byte[] png(String content, int size) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Nội dung QR không hợp lệ");
        }

        try {
            BitMatrix matrix = new MultiFormatWriter().encode(
                    content,
                    BarcodeFormat.QR_CODE,
                    Math.max(160, size),
                    Math.max(160, size),
                    hints()
            );

            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                MatrixToImageWriter.writeToStream(matrix, "PNG", output);
                return output.toByteArray();
            }
        } catch (WriterException exception) {
            throw new IllegalStateException("Không thể tạo mã QR", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể xuất ảnh QR", exception);
        }
    }

    public static String base64Png(String content, int size) {
        return Base64.getEncoder().encodeToString(png(content, size));
    }

    private static Map<EncodeHintType, Object> hints() {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 1);
        return hints;
    }
}
