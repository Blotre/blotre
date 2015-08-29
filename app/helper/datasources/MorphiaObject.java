package helper.datasources;

import com.mongodb.MongoClient;
import org.mongodb.morphia.Datastore;
import org.mongodb.morphia.Morphia;

public class MorphiaObject {

    static public MongoClient mongo;

    static public Morphia morphia;

    static public Datastore datastore;
}
