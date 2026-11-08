<?php

declare(strict_types=1);

namespace OCA\AutoTracker\Controller;

use OCA\AutoTracker\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IDBConnection;
use OCP\IRequest;
use OCP\IUserSession;

class VehicleController extends Controller {
	public function __construct(
		IRequest $request,
		private IDBConnection $db,
		private IUserSession $session,
		private IRootFolder $root,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	private function userId(): string {
		return $this->session->getUser()->getUID();
	}

	private function validData(array $data): bool {
		$strings = ['name', 'year', 'make', 'model', 'vin', 'units', 'currency', 'notes'];
		foreach ($strings as $key) {
			if (!isset($data[$key]) || !is_string($data[$key]) || strlen($data[$key]) > 10000) {
				return false;
			}
		}
		if (trim($data['name']) === '' || !in_array($data['units'], ['us', 'metric'], true)
			|| !preg_match('/^[A-Z]{3}$/', $data['currency'])) {
			return false;
		}
		$fields = [
			'specs' => ['id', 'name', 'value'],
			'mods' => ['id', 'date', 'title', 'odometer', 'cost', 'notes'],
			'fuel' => ['id', 'date', 'odometer', 'volume', 'cost', 'full', 'notes'],
			'service' => ['id', 'date', 'title', 'odometer', 'cost', 'notes'],
			'issues' => ['id', 'date', 'title', 'status', 'odometer', 'cost', 'notes'],
			'plans' => ['id', 'date', 'title', 'kind', 'status', 'cost', 'notes'],
			'photos' => ['id', 'fileId', 'name'],
		];
		foreach ($fields as $group => $keys) {
			if (!isset($data[$group]) || !is_array($data[$group]) || !array_is_list($data[$group]) || count($data[$group]) > 5000) {
				return false;
			}
			$ids = [];
			foreach ($data[$group] as $entry) {
				if (!is_array($entry)) {
					return false;
				}
				foreach ($keys as $key) {
					if (!isset($entry[$key]) || !is_string($entry[$key]) || strlen($entry[$key]) > 10000) {
						return false;
					}
				}
				if ($entry['id'] === '' || isset($ids[$entry['id']])) {
					return false;
				}
				$ids[$entry['id']] = true;
				foreach (['odometer', 'volume', 'cost'] as $key) {
					if (isset($entry[$key]) && $entry[$key] !== ''
						&& (!is_numeric($entry[$key]) || !is_finite((float)$entry[$key]) || (float)$entry[$key] < 0)) {
						return false;
					}
				}
				if ($group === 'fuel' && ($entry['date'] === '' || $entry['odometer'] === '' || $entry['volume'] === '' || (float)$entry['volume'] <= 0 || !in_array($entry['full'], ['yes', 'no'], true))) {
					return false;
				}
				if ($group === 'photos' && (!ctype_digit($entry['fileId']) || (int)$entry['fileId'] <= 0)) {
					return false;
				}
			}
		}
		return strlen(json_encode($data, JSON_THROW_ON_ERROR)) <= 2000000;
	}

	private function badData(): DataResponse {
		return new DataResponse(['error' => 'Invalid vehicle data. Check the required fields and numeric values.'], Http::STATUS_BAD_REQUEST);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): DataResponse {
		$query = $this->db->getQueryBuilder();
		$result = $query->select('id', 'data', 'revision')->from('auto_tracker_vehicles')
			->where($query->expr()->eq('user_id', $query->createNamedParameter($this->userId())))
			->orderBy('id', 'ASC')->executeQuery();
		$vehicles = [];
		while ($row = $result->fetchAssociative()) {
			$vehicles[] = ['id' => (int)$row['id'], 'revision' => (int)$row['revision'], 'data' => json_decode($row['data'], true, 512, JSON_THROW_ON_ERROR)];
		}
		$result->closeCursor();
		return new DataResponse($vehicles);
	}

	#[NoAdminRequired]
	public function create(array $data): DataResponse {
		if (!$this->validData($data)) {
			return $this->badData();
		}
		$query = $this->db->getQueryBuilder();
		$query->insert('auto_tracker_vehicles')->values([
			'user_id' => $query->createNamedParameter($this->userId()),
			'data' => $query->createNamedParameter(json_encode($data, JSON_THROW_ON_ERROR)),
			'revision' => $query->createNamedParameter(1),
		])->executeStatement();
		return new DataResponse(['id' => (int)$query->getLastInsertId(), 'revision' => 1, 'data' => $data], Http::STATUS_CREATED);
	}

	#[NoAdminRequired]
	public function update(int $id, int $revision, array $data): DataResponse {
		if (!$this->validData($data)) {
			return $this->badData();
		}
		$query = $this->db->getQueryBuilder();
		$affected = $query->update('auto_tracker_vehicles')
			->set('data', $query->createNamedParameter(json_encode($data, JSON_THROW_ON_ERROR)))
			->set('revision', $query->createNamedParameter($revision + 1))
			->where($query->expr()->eq('id', $query->createNamedParameter($id)))
			->andWhere($query->expr()->eq('user_id', $query->createNamedParameter($this->userId())))
			->andWhere($query->expr()->eq('revision', $query->createNamedParameter($revision)))
			->executeStatement();
		if ($affected !== 1) {
			return new DataResponse(['error' => 'This vehicle was changed or removed elsewhere. Reload before saving.'], Http::STATUS_CONFLICT);
		}
		return new DataResponse(['id' => $id, 'revision' => $revision + 1, 'data' => $data]);
	}

	#[NoAdminRequired]
	public function destroy(int $id, int $revision): DataResponse {
		$query = $this->db->getQueryBuilder();
		$affected = $query->delete('auto_tracker_vehicles')
			->where($query->expr()->eq('id', $query->createNamedParameter($id)))
			->andWhere($query->expr()->eq('user_id', $query->createNamedParameter($this->userId())))
			->andWhere($query->expr()->eq('revision', $query->createNamedParameter($revision)))
			->executeStatement();
		if ($affected !== 1) {
			return new DataResponse(['error' => 'This vehicle was changed or removed elsewhere. Reload before deleting.'], Http::STATUS_CONFLICT);
		}
		return new DataResponse(['deleted' => true]);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function files(int $folder = 0): DataResponse {
		$userFolder = $this->root->getUserFolder($this->userId());
		$directory = $userFolder;
		if ($folder !== 0) {
			$directory = null;
			foreach ($userFolder->getById($folder) as $node) {
				if ($node instanceof Folder && $node->isReadable()) {
					$directory = $node;
					break;
				}
			}
			if ($directory === null) {
				return new DataResponse(['error' => 'Folder not found or not accessible.'], Http::STATUS_NOT_FOUND);
			}
		}
		$entries = [];
		foreach ($directory->getDirectoryListing() as $node) {
			if (!$node->isReadable()) {
				continue;
			}
			if ($node instanceof Folder || ($node instanceof File && str_starts_with($node->getMimetype(), 'image/'))) {
				$entries[] = ['id' => $node->getId(), 'name' => $node->getName(), 'folder' => $node instanceof Folder];
			}
		}
		usort($entries, static fn (array $a, array $b): int => ($b['folder'] <=> $a['folder']) ?: strcasecmp($a['name'], $b['name']));
		return new DataResponse($entries);
	}
}
