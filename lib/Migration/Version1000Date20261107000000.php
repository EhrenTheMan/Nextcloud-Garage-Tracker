<?php

declare(strict_types=1);

namespace OCA\AutoTracker\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

class Version1000Date20261107000000 extends SimpleMigrationStep {
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		$schema = $schemaClosure();
		if (!$schema->hasTable('auto_tracker_vehicles')) {
			$table = $schema->createTable('auto_tracker_vehicles');
			$table->addColumn('id', 'bigint', ['autoincrement' => true, 'notnull' => true, 'unsigned' => true]);
			$table->addColumn('user_id', 'string', ['length' => 64, 'notnull' => true]);
			$table->addColumn('data', 'text', ['notnull' => true, 'length' => 2000000]);
			$table->addColumn('revision', 'integer', ['notnull' => true, 'default' => 1]);
			$table->setPrimaryKey(['id']);
			$table->addIndex(['user_id'], 'auto_tracker_user_idx');
		}
		return $schema;
	}
}
