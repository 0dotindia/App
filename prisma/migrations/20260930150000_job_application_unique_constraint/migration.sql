-- P0 review finding #4: the applyToJob check-then-create was not atomic,
-- so a true race could still double-apply. This makes that impossible at
-- the DB layer.
CREATE UNIQUE INDEX "JobApplication_jobId_applicantId_key" ON "JobApplication"("jobId", "applicantId");
