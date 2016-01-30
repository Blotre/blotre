#!/bin/bash

SERVER=$1

USER=blotre
REMOTE=$USER@$SERVER
REMOTE_APP=/home/$USER/blotre/

sbt stage || exit 1;
rsync -va target/ $REMOTE:$REMOTE_APP/target;
ssh $REMOTE "cd $REMOTE_APP; ./stop.sh";
ssh $REMOTE "cd $REMOTE_APP; ./start.sh";
