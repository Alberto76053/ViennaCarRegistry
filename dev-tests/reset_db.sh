#!/bin/bash
P="psql -h /tmp/pg -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists vcr" -c "create database vcr" 2>&1 | grep -v NOTICE
$P -d vcr -f /home/claude/tools/stubs.sql
$P -d vcr -f /home/claude/viennacarregistry/supabase/schema.sql
