package helper.datasources;

import com.mongodb.MongoClient;
import com.mongodb.MongoClientURI;
import models.*;
import org.mongodb.morphia.Morphia;
import play.Logger;
import play.Play;

import java.net.UnknownHostException;

public final class MongoDB
{
    public static boolean connect()
    {
        String _mongoURI = Play.application().configuration().getString("mongodb.uri");

        MongoClientURI mongoURI = new MongoClientURI(_mongoURI);

        MorphiaObject.mongo = null;
        try {
            MorphiaObject.mongo = new MongoClient(mongoURI);
        } catch(UnknownHostException e) {
            Logger.info("Unknown Host");
        }

        if (MorphiaObject.mongo != null) {
            MorphiaObject.morphia = new Morphia();
            MorphiaObject.morphia.getMapper().getOptions().storeEmpties = true;

            MorphiaObject.datastore = MorphiaObject.morphia.createDatastore(MorphiaObject.mongo, mongoURI.getDatabase());

            // Map classes
            MorphiaObject.morphia.map(AccessToken.class);
            MorphiaObject.morphia.map(AuthCode.class);
            MorphiaObject.morphia.map(ChildStream.class);
            MorphiaObject.morphia.map(Client.class);
            MorphiaObject.morphia.map(LinkedAccount.class);
            MorphiaObject.morphia.map(OneTimeCode.class);
            MorphiaObject.morphia.map(SecurityRole.class);
            MorphiaObject.morphia.map(Status.class);
            MorphiaObject.morphia.map(Stream.class);
            MorphiaObject.morphia.map(User.class);
            MorphiaObject.morphia.map(UserPermission.class);

            MorphiaObject.datastore.ensureIndexes();
            MorphiaObject.datastore.ensureCaps();
        }

        Logger.debug("** Morphia datastore: " + MorphiaObject.datastore.getDB());

        return true;
    }

    public static boolean disconnect()
    {
        if (MorphiaObject.mongo == null) {
            return false;
        }

        MorphiaObject.morphia = null;
        MorphiaObject.datastore = null;
        MorphiaObject.mongo.close();
        return true;
    }
}

