import Notification from '../schemas/Notification'
import User from '../models/User'

class NotificationController {
  async index (req, res) {
    const checkIsProvider = await User.findOne({
      where: { id: req.userId, provider: true }
    })

    if (!checkIsProvider) {
      res
        .status(401)
        .json({ error: 'Somente prestadores podem ler as notificações.' })
    }

    const notification = await Notification.find({
      user: req.userId
    }).sort({ 'created_at': -1 }).limit(20)

    res.json(notification)
  }
  async update (req, res) {
    // const notification = await Notification.findById(req.parms.id)
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    )
    res.json(notification)
  }
}

export default new NotificationController()
