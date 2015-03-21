package helper;

import java.awt.image.*;
import java.awt.Image;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;

public class ImageHelper
{
    public static RenderedImage createImage(int rgb)
    {
        BufferedImage img = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        img.setRGB(0, 0, rgb);
        return img;
    }

    public static RenderedImage createImage(String rgbHex)
    {
        if (rgbHex.length() > 0 && rgbHex.charAt(0) == '#')
            return createImage(rgbHex.substring(1));
        else
            return createImage(Integer.parseInt(rgbHex, 16));
    }

    public static byte[] toPng(RenderedImage img)
    {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            return new byte[0];
        }
    }
}
