// Business layer: rules and error translation. No SQL here, no req/res here.
import { HttpError, notFound } from '../../utils/http-error.js';
import * as repo from './departments.repository.js';

const FK_VIOLATION = 547;

export const list = (query) => repo.findAll(query);

export async function get(id) {
  const department = await repo.findById(id);
  if (!department) throw notFound('khoa');
  return department;
}

export async function create(data) {
  const id = await repo.insert(data);
  return repo.findById(id);
}

export async function update(id, data) {
  if (!(await repo.update(id, data))) throw notFound('khoa');
  return repo.findById(id);
}

export async function remove(id) {
  try {
    if (!(await repo.remove(id))) throw notFound('khoa');
  } catch (err) {
    if (err.number === FK_VIOLATION) throw new HttpError(409, 'Không thể xoá khoa đang có bác sĩ trực thuộc');
    throw err;
  }
}
