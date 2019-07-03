import * as Yup from 'yup'
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns'
import pt from 'date-fns/locale/pt'

import User from '../models/User'
import File from '../models/File'
import Appointment from '../models/Appointment'
import Notification from '../schemas/Notification'

class AppointmentController {
  async index (req, res) {
    const { page = 1 } = req.query
    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      attributes: ['id', 'date'],
      order: ['date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url']
            }
          ]
        }
      ]
    })
    res.json(appointments)
  }

  async store (req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required()
    })

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Dados inválidos!' })
    }

    const { provider_id, date } = req.body

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true }
    })

    if (!isProvider) {
      res
        .status(401)
        .json({ error: 'Você só pode agendar com prestadores de serviço' })
    }

    const hourStart = startOfHour(parseISO(date))

    if (isBefore(hourStart, new Date())) {
      return res
        .status(400)
        .json({ error: 'Datas passadas não são permitidas!' })
    }

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart
      }
    })

    if (checkAvailability) {
      return res.status(400).json({ error: 'Horário indisponível!' })
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date
    })

    const user = await User.findByPk(req.userId)
    const formatedDate = format(hourStart, "'dia' dd 'de' MMMM', às' H:mm'h'", {
      locale: pt
    })
    await Notification.create({
      content: `Novo agendamento de ${user.name} para o ${formatedDate}.`,
      user: provider_id
    })

    return res.json(appointment)
  }
  async delete (req, res) {
    const appointment = await Appointment.findByPk(req.params.id)

    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        error: 'Você não pode cancelar este agendamento.'
      })
    }

    const dateWithSub = subHours(appointment.date, 2)
    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error: 'Você só pode cancelar o agendamento duas horas antes.'
      })
    }

    appointment.canceled_at = new Date()

    await appointment.save()

    res.json(appointment)
  }
}

export default new AppointmentController()
