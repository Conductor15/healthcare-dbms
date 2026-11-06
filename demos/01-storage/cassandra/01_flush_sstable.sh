

cqlsh -e "INSERT INTO healthcare.latest_vitals_by_patient (patient_id, recorded_at, heart_rate, temperature) VALUES (1, toTimestamp(now()), 85, 37.2);"

nodetool flush healthcare latest_vitals_by_patient

ls -lh /var/lib/cassandra/data/healthcare/latest_vitals_by_patient-*

# sstabledump /var/lib/cassandra/data/healthcare/latest_vitals_by_patient-<id>-Data.db
