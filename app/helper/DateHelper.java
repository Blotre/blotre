package helper;

import java.text.SimpleDateFormat;
import java.util.Date;


public class DateHelper {

    public static String toJson(final Date date)
    {
        final SimpleDateFormat format = new SimpleDateFormat("Z");
        return "/Date(" + String.valueOf(date.getTime()) + format.format(date) + ")/";
    }
}
