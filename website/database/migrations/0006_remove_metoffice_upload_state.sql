-- Met Office WOW is being retired, so we no longer upload to it
DELETE FROM `upload_state` WHERE `target` = 'metoffice';
